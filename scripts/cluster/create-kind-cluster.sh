#!/bin/bash

set -e

echo "Creating Kind cluster..."
kind create cluster --config kind-config.yaml

echo "Cluster created successfully."
kubectl get nodes