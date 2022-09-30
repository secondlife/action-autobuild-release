import { test, expect } from "@jest/globals";
import { loadConfig } from "../src/config";

test('empty config has defaults', () => {
    const config = loadConfig({});
    expect(config.public_release).toBe(false);
    expect(config.github_token).toBe('');
});

test('config uses values from env', () => {
    const config = loadConfig({"INPUT_PUBLIC": "true", "GITHUB_TOKEN": "token-123"});
    expect(config.public_release).toBe(true);
    expect(config.github_token).toBe("token-123");
});
