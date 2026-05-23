#!/bin/bash

# Create certs directory
mkdir -p certs

# Generate SSL certificate for localhost
openssl req -x509 -out certs/localhost.pem -keyout certs/localhost-key.pem \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=localhost' -extensions EXT -config <( \
   printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")

echo "SSL certificates generated in certs/ directory"
echo "You can now run: npm run dev:https"