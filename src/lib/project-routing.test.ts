import assert from "node:assert/strict";
import test from "node:test";

import { isProjectDetailPath } from "./project-routing.ts";

test("project route renders the nested details outlet for direct project URLs", () => {
  assert.equal(isProjectDetailPath("/projects/b7c77101-5d65-436a-8da0-7e59a792b0cf"), true);
  assert.equal(isProjectDetailPath("/projects/not-a-project-id"), true);
  assert.equal(isProjectDetailPath("/projects"), false);
});
