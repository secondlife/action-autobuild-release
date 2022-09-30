import { expect, describe, test } from "@jest/globals"
import { basename } from "../src/util"

describe("basename", () => {
    test("windows-style", () => {
        expect(basename(`C:\\TEMP\\foo\\basename.tar.zst`)).toBe("basename.tar.zst")
    })

    test("nix-style", () => {
        expect(basename(`/tmp/foo/basename.tar.zst`)).toBe("basename.tar.zst")
    })
})
