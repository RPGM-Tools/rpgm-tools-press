# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Full-text search on both sites via Pagefind, indexed as a postbuild step
  and mounted lazily from the header's search trigger.
- GitHub Discussions-backed comments via giscus on blog posts and release
  pages, gated behind a real Discussion category ID per app.
- Cloudflare Web Analytics wiring in the shared Layout, enabled per app via
  a `PUBLIC_CF_BEACON_TOKEN` build-time env var.
