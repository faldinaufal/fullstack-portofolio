# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Copyright (c) 2026 Farhan Aldi Naufal

# Builds every Tempora image in one go, the way `docker compose build` does, so the images
# share the dependency install and the builds of the root Dockerfile. Used by CI:
#   docker buildx bake
# Every variable below can be overridden from the environment. CI's production build sets
#   REGISTRY=ghcr.io/<owner>/  TAGS=<sha>,latest  API_URL=https://api.<domain>  ...

variable "REGISTRY" {
  default = ""
}

# Comma-separated, e.g. "3f2c1ab,latest".
variable "TAGS" {
  default = "local"
}

# Browser-facing values compiled into the apps (FSD 10.4).
variable "API_URL" {
  default = "http://localhost:4000"
}

variable "CONSOLE_URL" {
  default = "http://localhost:3001"
}

variable "APP_TIME_ZONE" {
  default = "America/New_York"
}

# Links the pushed images to the repository on GitHub Container Registry.
variable "SOURCE_URL" {
  default = "https://github.com/faldinaufal/fullstack-portofolio"
}

function "tags" {
  params = [service]
  result = [for tag in split(",", TAGS) : "${REGISTRY}tempora-${service}:${tag}"]
}

group "default" {
  targets = ["api", "worker", "migrate", "portal", "console", "platform-admin"]
}

target "_common" {
  context    = "."
  dockerfile = "Dockerfile"
  args = {
    NEXT_PUBLIC_API_URL       = API_URL
    NEXT_PUBLIC_CONSOLE_URL   = CONSOLE_URL
    NEXT_PUBLIC_APP_TIME_ZONE = APP_TIME_ZONE
  }
  labels = {
    "org.opencontainers.image.source" = SOURCE_URL
  }
}

target "api" {
  inherits = ["_common"]
  target   = "api"
  tags     = tags("api")
}

target "worker" {
  inherits = ["_common"]
  target   = "worker"
  tags     = tags("worker")
}

target "migrate" {
  inherits = ["_common"]
  target   = "migrate"
  tags     = tags("migrate")
}

target "portal" {
  inherits = ["_common"]
  target   = "portal"
  tags     = tags("portal")
}

target "console" {
  inherits = ["_common"]
  target   = "console"
  tags     = tags("console")
}

target "platform-admin" {
  inherits = ["_common"]
  target   = "platform-admin"
  tags     = tags("platform-admin")
}
