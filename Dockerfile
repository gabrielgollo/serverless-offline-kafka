FROM node:18-alpine

# CI image used by GitLab jobs:
# - node + npm for project scripts
# - docker CLI + docker compose plugin to talk to docker:dind service
RUN apk add --no-cache docker-cli docker-cli-compose bash git

WORKDIR /workspace
