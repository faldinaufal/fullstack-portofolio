# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Copyright (c) 2026 Farhan Aldi Naufal

# Builds every Tempora image in one go, the way `docker compose build` does, so the images
# share the dependency install and the builds of the root Dockerfile. Used by CI:
#   docker buildx bake

group "default" {
  targets = ["api", "worker", "migrate", "portal", "console", "platform-admin"]
}

target "_common" {
  context    = "."
  dockerfile = "Dockerfile"
  args = {
    NEXT_PUBLIC_API_URL = "http://localhost:4000"
  }
}

target "api" {
  inherits = ["_common"]
  target   = "api"
  tags     = ["tempora-api:local"]
}

target "worker" {
  inherits = ["_common"]
  target   = "worker"
  tags     = ["tempora-worker:local"]
}

target "migrate" {
  inherits = ["_common"]
  target   = "migrate"
  tags     = ["tempora-migrate:local"]
}

target "portal" {
  inherits = ["_common"]
  target   = "portal"
  tags     = ["tempora-portal:local"]
}

target "console" {
  inherits = ["_common"]
  target   = "console"
  tags     = ["tempora-console:local"]
}

target "platform-admin" {
  inherits = ["_common"]
  target   = "platform-admin"
  tags     = ["tempora-platform-admin:local"]
}
