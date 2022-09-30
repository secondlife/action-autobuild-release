import { expect, test } from "@jest/globals";
import { run } from "../src/main";

test("tag is required", async () => {
    await expect(run({}))
    .rejects
    .toThrow("Autobuild Release requires a tag");
});
