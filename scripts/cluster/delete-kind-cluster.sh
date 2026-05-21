#!/bin/bash

set -e

echo "Deleting Kind cluster..."
kind delete cluster --name video-platform

echo "Cluster deleted."