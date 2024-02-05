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

test('parse upload_to', () => {
  const config = loadConfig({"INPUT_UPLOAD-TO": "s3://bucket-name,github-release://"});
  expect(config.upload_to).toEqual([
      {scheme: "s3", path: "bucket-name"},
      {scheme: "github-release", path: ""},
  ]);
});

test('upload_to should raise exception if unknown scheme provided', () => {
  const t = () => loadConfig({"INPUT_UPLOAD-TO": "unknown://"});
  expect(t).toThrowError("Invalid upload_to scheme: unknown://. Accepted, s3:// or github-release://");
});
