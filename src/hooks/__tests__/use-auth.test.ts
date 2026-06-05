import { test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" } as any);
});

// Initial state

test("isLoading starts as false", () => {
  const { result } = renderHook(() => useAuth());
  expect(result.current.isLoading).toBe(false);
});

test("exposes signIn, signUp, and isLoading", () => {
  const { result } = renderHook(() => useAuth());
  expect(typeof result.current.signIn).toBe("function");
  expect(typeof result.current.signUp).toBe("function");
  expect(typeof result.current.isLoading).toBe("boolean");
});

// signIn — loading state

test("signIn sets isLoading to true while in flight", async () => {
  let resolveSignIn!: (v: any) => void;
  mockSignIn.mockReturnValue(new Promise((r) => (resolveSignIn = r)));

  const { result } = renderHook(() => useAuth());

  act(() => {
    result.current.signIn("a@b.com", "password");
  });

  expect(result.current.isLoading).toBe(true);

  await act(async () => {
    resolveSignIn({ success: false, error: "bad" });
  });

  expect(result.current.isLoading).toBe(false);
});

test("signIn resets isLoading to false after success", async () => {
  mockSignIn.mockResolvedValue({ success: true });
  mockGetProjects.mockResolvedValue([{ id: "p1" } as any]);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("a@b.com", "password");
  });

  expect(result.current.isLoading).toBe(false);
});

test("signIn resets isLoading to false even when action throws", async () => {
  mockSignIn.mockRejectedValue(new Error("network error"));

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("a@b.com", "password").catch(() => {});
  });

  expect(result.current.isLoading).toBe(false);
});

// signIn — return value

test("signIn returns the result from the server action", async () => {
  const expected = { success: false, error: "Invalid credentials" };
  mockSignIn.mockResolvedValue(expected);

  const { result } = renderHook(() => useAuth());
  let returned: any;
  await act(async () => {
    returned = await result.current.signIn("a@b.com", "wrong");
  });

  expect(returned).toEqual(expected);
});

test("signIn passes email and password to the server action", async () => {
  mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "s3cr3t");
  });

  expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "s3cr3t");
});

// signIn — post sign-in navigation: anonymous work

test("signIn with anon work creates a project from that data and navigates to it", async () => {
  mockSignIn.mockResolvedValue({ success: true });
  mockGetAnonWorkData.mockReturnValue({
    messages: [{ role: "user", content: "hi" }],
    fileSystemData: { "/App.jsx": "export default () => <div/>" },
  });
  mockCreateProject.mockResolvedValue({ id: "anon-project-id" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("a@b.com", "password");
  });

  expect(mockCreateProject).toHaveBeenCalledWith(
    expect.objectContaining({
      messages: [{ role: "user", content: "hi" }],
      data: { "/App.jsx": "export default () => <div/>" },
    })
  );
  expect(mockClearAnonWork).toHaveBeenCalledOnce();
  expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
});

test("signIn with anon work does not call getProjects", async () => {
  mockSignIn.mockResolvedValue({ success: true });
  mockGetAnonWorkData.mockReturnValue({
    messages: [{ role: "user", content: "hi" }],
    fileSystemData: {},
  });

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("a@b.com", "password");
  });

  expect(mockGetProjects).not.toHaveBeenCalled();
});

test("signIn with anon work that has no messages falls through to projects", async () => {
  mockSignIn.mockResolvedValue({ success: true });
  mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
  mockGetProjects.mockResolvedValue([{ id: "existing-p" } as any]);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("a@b.com", "password");
  });

  expect(mockPush).toHaveBeenCalledWith("/existing-p");
  expect(mockCreateProject).not.toHaveBeenCalled();
});

// signIn — post sign-in navigation: existing projects

test("signIn without anon work navigates to the most recent project", async () => {
  mockSignIn.mockResolvedValue({ success: true });
  mockGetProjects.mockResolvedValue([
    { id: "recent" } as any,
    { id: "older" } as any,
  ]);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("a@b.com", "password");
  });

  expect(mockPush).toHaveBeenCalledWith("/recent");
  expect(mockCreateProject).not.toHaveBeenCalled();
});

// signIn — post sign-in navigation: no projects

test("signIn without anon work and no projects creates a new project and navigates to it", async () => {
  mockSignIn.mockResolvedValue({ success: true });
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "brand-new" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("a@b.com", "password");
  });

  expect(mockCreateProject).toHaveBeenCalledWith(
    expect.objectContaining({ messages: [], data: {} })
  );
  expect(mockPush).toHaveBeenCalledWith("/brand-new");
});

// signIn — failed auth skips navigation

test("signIn does not navigate on failure", async () => {
  mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("a@b.com", "wrong");
  });

  expect(mockPush).not.toHaveBeenCalled();
  expect(mockGetProjects).not.toHaveBeenCalled();
  expect(mockCreateProject).not.toHaveBeenCalled();
});

// signUp — loading state

test("signUp sets isLoading to true while in flight", async () => {
  let resolveSignUp!: (v: any) => void;
  mockSignUp.mockReturnValue(new Promise((r) => (resolveSignUp = r)));

  const { result } = renderHook(() => useAuth());

  act(() => {
    result.current.signUp("a@b.com", "password");
  });

  expect(result.current.isLoading).toBe(true);

  await act(async () => {
    resolveSignUp({ success: false, error: "exists" });
  });

  expect(result.current.isLoading).toBe(false);
});

test("signUp resets isLoading to false even when action throws", async () => {
  mockSignUp.mockRejectedValue(new Error("network error"));

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signUp("a@b.com", "password").catch(() => {});
  });

  expect(result.current.isLoading).toBe(false);
});

// signUp — return value and delegation

test("signUp passes email and password to the server action", async () => {
  mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signUp("new@example.com", "mypassword");
  });

  expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "mypassword");
});

test("signUp returns the result from the server action", async () => {
  const expected = { success: false, error: "Email already registered" };
  mockSignUp.mockResolvedValue(expected);

  const { result } = renderHook(() => useAuth());
  let returned: any;
  await act(async () => {
    returned = await result.current.signUp("existing@example.com", "pass");
  });

  expect(returned).toEqual(expected);
});

// signUp — post sign-up navigation mirrors signIn post-auth logic

test("signUp with anon work creates a project and navigates to it", async () => {
  mockSignUp.mockResolvedValue({ success: true });
  mockGetAnonWorkData.mockReturnValue({
    messages: [{ role: "user", content: "build me a button" }],
    fileSystemData: { "/App.jsx": "export default () => <button/>" },
  });
  mockCreateProject.mockResolvedValue({ id: "signup-anon-project" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signUp("new@example.com", "password");
  });

  expect(mockCreateProject).toHaveBeenCalledOnce();
  expect(mockClearAnonWork).toHaveBeenCalledOnce();
  expect(mockPush).toHaveBeenCalledWith("/signup-anon-project");
});

test("signUp without anon work and no projects creates a new project", async () => {
  mockSignUp.mockResolvedValue({ success: true });
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "first-project" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signUp("new@example.com", "password");
  });

  expect(mockPush).toHaveBeenCalledWith("/first-project");
});

test("signUp does not navigate on failure", async () => {
  mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signUp("existing@example.com", "password");
  });

  expect(mockPush).not.toHaveBeenCalled();
});

// New project name format

test("new project name created on sign-in is a non-empty string", async () => {
  mockSignIn.mockResolvedValue({ success: true });
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "p" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("a@b.com", "password");
  });

  const { name } = mockCreateProject.mock.calls[0][0];
  expect(typeof name).toBe("string");
  expect(name.length).toBeGreaterThan(0);
});

test("anon work project name includes a time-based label", async () => {
  mockSignIn.mockResolvedValue({ success: true });
  mockGetAnonWorkData.mockReturnValue({
    messages: [{ role: "user", content: "hi" }],
    fileSystemData: {},
  });
  mockCreateProject.mockResolvedValue({ id: "p" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("a@b.com", "password");
  });

  const { name } = mockCreateProject.mock.calls[0][0];
  expect(name).toMatch(/Design from /);
});
