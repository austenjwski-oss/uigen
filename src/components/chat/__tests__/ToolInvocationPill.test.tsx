import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocationPill } from "../ToolInvocationPill";

afterEach(() => {
  cleanup();
});

test("str_replace_editor create shows Creating label", () => {
  render(
    <ToolInvocationPill
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      state="result"
      result="Success"
    />
  );
  expect(screen.getByText("Creating /App.jsx")).toBeDefined();
});

test("str_replace_editor str_replace shows Editing label", () => {
  render(
    <ToolInvocationPill
      toolName="str_replace_editor"
      args={{ command: "str_replace", path: "/components/Card.jsx" }}
      state="result"
      result="Success"
    />
  );
  expect(screen.getByText("Editing /components/Card.jsx")).toBeDefined();
});

test("str_replace_editor insert shows Editing label", () => {
  render(
    <ToolInvocationPill
      toolName="str_replace_editor"
      args={{ command: "insert", path: "/App.jsx" }}
      state="result"
      result="Success"
    />
  );
  expect(screen.getByText("Editing /App.jsx")).toBeDefined();
});

test("str_replace_editor view shows Reading label", () => {
  render(
    <ToolInvocationPill
      toolName="str_replace_editor"
      args={{ command: "view", path: "/App.jsx" }}
      state="result"
      result="Success"
    />
  );
  expect(screen.getByText("Reading /App.jsx")).toBeDefined();
});

test("file_manager rename shows Renaming label with both paths", () => {
  render(
    <ToolInvocationPill
      toolName="file_manager"
      args={{ command: "rename", path: "/old.jsx", new_path: "/new.jsx" }}
      state="result"
      result="Success"
    />
  );
  const label = screen.getByText("Renaming /old.jsx → /new.jsx");
  expect(label).toBeDefined();
});

test("file_manager delete shows Deleting label", () => {
  render(
    <ToolInvocationPill
      toolName="file_manager"
      args={{ command: "delete", path: "/App.jsx" }}
      state="result"
      result="Success"
    />
  );
  expect(screen.getByText("Deleting /App.jsx")).toBeDefined();
});

test("unknown tool falls back to raw tool name", () => {
  render(
    <ToolInvocationPill
      toolName="some_unknown_tool"
      args={{}}
      state="result"
      result="Success"
    />
  );
  expect(screen.getByText("some_unknown_tool")).toBeDefined();
});

test("in-progress state shows spinner", () => {
  const { container } = render(
    <ToolInvocationPill
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      state="call"
    />
  );
  expect(container.querySelector(".animate-spin")).toBeTruthy();
});

test("completed state shows green dot, not spinner", () => {
  const { container } = render(
    <ToolInvocationPill
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      state="result"
      result="Success"
    />
  );
  expect(container.querySelector(".bg-emerald-500")).toBeTruthy();
  expect(container.querySelector(".animate-spin")).toBeNull();
});
