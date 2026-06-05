import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

afterEach(() => {
  cleanup();
});

// Reproduces the Preview/Code toggle from src/app/main-content.tsx so we can
// verify clicking the buttons actually switches the rendered view.
function ToggleHarness() {
  const [activeView, setActiveView] = useState<"preview" | "code">("preview");

  return (
    <div>
      <Tabs
        value={activeView}
        onValueChange={(v) => setActiveView(v as "preview" | "code")}
      >
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>
      </Tabs>
      <div>
        {activeView === "preview" ? (
          <div>PREVIEW_CONTENT</div>
        ) : (
          <div>CODE_CONTENT</div>
        )}
      </div>
    </div>
  );
}

test("clicking the toggle buttons switches between preview and code views", async () => {
  const user = userEvent.setup();
  render(<ToggleHarness />);

  // Starts on preview
  expect(screen.getByText("PREVIEW_CONTENT")).toBeDefined();
  expect(screen.queryByText("CODE_CONTENT")).toBeNull();

  // Click "Code"
  await user.click(screen.getByRole("tab", { name: "Code" }));
  expect(screen.getByText("CODE_CONTENT")).toBeDefined();
  expect(screen.queryByText("PREVIEW_CONTENT")).toBeNull();

  // Click "Preview" again
  await user.click(screen.getByRole("tab", { name: "Preview" }));
  expect(screen.getByText("PREVIEW_CONTENT")).toBeDefined();
  expect(screen.queryByText("CODE_CONTENT")).toBeNull();
});
