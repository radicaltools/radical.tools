#!/bin/sh
# radical.sh runs the radical command line (https://radical.tools) with a
# Node.js it finds on the PATH or, where there is none, downloads.
#
#   sh radical.sh setup          connects your coding agents to a model folder
#   sh radical.sh <command> ...  any radical command (sh radical.sh --help)
#   sh radical.sh mcp ...        the MCP server, as the agents start it
#
# Node.js 20.11 or later with npx beside it is taken from the PATH, else from
# ~/.radical/node (RADICAL_HOME). With neither, it asks (or takes --yes) and
# downloads the latest Node.js 24 for this platform from nodejs.org
# (RADICAL_NODE_MIRROR), checked against its SHA-256 sum. It never asks for
# mcp: an agent has no terminal to answer in.
#
# radical setup pins the version below to its own. RADICAL_VERSION picks
# another for one run: RADICAL_VERSION=latest sh radical.sh setup upgrades.
set -eu

default_version=latest
version=${RADICAL_VERSION:-$default_version}
home=${RADICAL_HOME:-"$HOME/.radical"}
mirror=${RADICAL_NODE_MIRROR:-https://nodejs.org/dist}
node_line=24

say() { printf '%s\n' "$*" >&2; }
fail() { say "radical.sh: $*"; exit 1; }

# True when node $1 is 20.11 or later, the MCP server's minimum.
recent() {
  "$1" -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 20 || (a === 20 && b >= 11) ? 0 : 1)' 2>/dev/null
}

bin=
if node=$(command -v node 2>/dev/null) && [ -x "$(dirname "$node")/npx" ] && recent "$node"; then
  bin=$(dirname "$node")
fi

case $(uname -s) in Darwin) os=darwin ;; Linux) os=linux ;; *) os= ;; esac
case $(uname -m) in x86_64 | amd64) arch=x64 ;; arm64 | aarch64) arch=arm64 ;; *) arch= ;; esac

# One downloaded before: any of them will do.
if [ -z "$bin" ] && [ -n "$os" ] && [ -n "$arch" ]; then
  for dir in "$home"/node/node-v*-"$os"-"$arch"; do
    if [ -x "$dir/bin/node" ] && [ -x "$dir/bin/npx" ]; then bin=$dir/bin; fi
  done
fi

if [ -z "$bin" ]; then
  [ "${1:-}" != mcp ] || fail "no Node.js 20.11 or later is installed: run sh radical.sh setup in a terminal first, which downloads one."
  [ -n "$os" ] && [ -n "$arch" ] || fail "no Node.js 20.11 or later is installed, and nodejs.org has no build for $(uname -sm): install one (https://nodejs.org) and run it again."
  yes=${RADICAL_YES:-}
  for arg in "$@"; do case $arg in --yes | -y) yes=1 ;; esac; done
  if [ -z "$yes" ] && [ -t 0 ]; then
    printf 'Node.js 20.11 or later is not installed. Download Node.js %s (about 50 MB) from %s into %s? [yes] ' "$node_line" "$mirror" "$home/node" >&2
    read -r answer || answer=no
    case $answer in '' | y* | Y*) yes=1 ;; esac
  fi
  [ -n "$yes" ] || fail "no Node.js 20.11 or later is installed: install one (https://nodejs.org), or run it in a terminal or with --yes to download Node.js $node_line into $home/node."

  fetch() {
    if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"
    elif command -v wget >/dev/null 2>&1; then wget -qO "$2" "$1"
    else fail "neither curl nor wget is installed to download Node.js with."
    fi
  }
  sha256() {
    if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d ' ' -f 1
  }
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  dist=$mirror/latest-v$node_line.x
  fetch "$dist/SHASUMS256.txt" "$tmp/sums" || fail "could not download $dist/SHASUMS256.txt."
  line=$(grep " node-v[0-9.]*-$os-$arch\.tar\.gz\$" "$tmp/sums" | head -n 1) || true
  [ -n "$line" ] || fail "$dist has no Node.js build for $os-$arch."
  name=${line##* }
  name=${name%.tar.gz}
  say "Downloading $name from $dist ..."
  fetch "$dist/$name.tar.gz" "$tmp/node.tar.gz" || fail "could not download $dist/$name.tar.gz."
  [ "$(sha256 "$tmp/node.tar.gz")" = "${line%% *}" ] || fail "$name.tar.gz does not match its SHA-256 sum in SHASUMS256.txt, so it was not installed."
  tar -xzf "$tmp/node.tar.gz" -C "$tmp"
  mkdir -p "$home/node"
  rm -rf "$home/node/$name"
  mv "$tmp/$name" "$home/node/$name"
  rm -rf "$tmp"
  trap - EXIT
  bin=$home/node/$name/bin
  say "Node.js is in $home/node/$name."
fi

PATH=$bin:$PATH
RADICAL_LAUNCHER=$(cd "$(dirname "$0")" && pwd)/$(basename "$0")
export PATH RADICAL_LAUNCHER
if [ "${1:-}" = mcp ]; then
  shift
  exec "$bin/npx" -y "@radicaltools/mcp@$version" "$@"
fi
exec "$bin/npx" -y "@radicaltools/cli@$version" "$@"
