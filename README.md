# action-autobuild-release

Collects autobuild artifacts from previous jobs and uploads them to GitHub Releases.

## Use

The following is an example of using **action-autobuild-release** with
**action-autobuild**:

```yaml
name: Build
on: [push]
jobs:
  build:
    strategy:
      matrix:
        os: [windows-2022, macos-11, ubuntu-22.04]
        addrsize: ["64"]
        include:
          - os: windows-2022
            addrsize: "32"
    runs-on: ${{ matrix.os }}
    steps:
      - uses: secondlife/action-autobuild@v3
        with:
          addrsize: ${{ matrix.addrsize }}
  release:
    needs: build
    runs-on: [ubuntu-latest]
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - uses: secondlife/action-autobuild-release@v3
        with:
          public: true
```

### Publishing assets to S3

If you want to upload your release artifacts to S3 in addition to github:

```yaml
steps:
  - uses: secondlife/action-autobuild-release@v3
    with:
      public: true
      upload-to: |
        github-release://
        s3://my-bucket/prefix-1/
```

...or just s3:

```yaml
permissions:
  id-token: write
  contents: write 
steps:
  - name: Configure AWS credentials
    uses: aws-actions/configure-aws-credentials@v4
    with:
      aws-region: us-west-2
      role-to-assume: ${{ vars.AWS_ROLE_ARN }}
  - uses: secondlife/action-autobuild-release@v3
    with:
      public: true
      upload-to: s3://my-bucket/prefix-1/
```
