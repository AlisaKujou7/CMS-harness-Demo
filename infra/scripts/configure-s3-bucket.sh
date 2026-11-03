#!/usr/bin/env bash
# Run once when media lives in an external S3 service. Browsers upload to the bucket directly, so it
# must allow the admin site's origin. It also keeps the bucket private, as SEC-06 requires.
set -euo pipefail

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
load_env

cors="$(sed "s|__PUBLIC_URL__|${PUBLIC_URL}|" "${INFRA_DIR}/s3/bucket-cors.template.json")"
endpoint_args=()
if [ -n "${OBJECT_STORAGE_ENDPOINT:-}" ]; then
  endpoint_args=(--endpoint-url "${OBJECT_STORAGE_ENDPOINT}")
fi

aws_cli() {
  docker run --rm --network "${AWS_CLI_NETWORK:-bridge}" \
    -e AWS_ACCESS_KEY_ID="${OBJECT_STORAGE_ACCESS_KEY}" \
    -e AWS_SECRET_ACCESS_KEY="${OBJECT_STORAGE_SECRET_KEY}" \
    -e AWS_DEFAULT_REGION="${OBJECT_STORAGE_REGION:-us-east-1}" \
    amazon/aws-cli:2.27.0 "${endpoint_args[@]}" s3api "$@"
}

aws_cli put-bucket-cors --bucket "${OBJECT_STORAGE_BUCKET}" --cors-configuration "${cors}"
aws_cli get-bucket-cors --bucket "${OBJECT_STORAGE_BUCKET}"
if [ -z "${OBJECT_STORAGE_ENDPOINT:-}" ]; then
  aws_cli put-public-access-block --bucket "${OBJECT_STORAGE_BUCKET}" \
    --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
fi
echo "Bucket ${OBJECT_STORAGE_BUCKET} allows uploads from ${PUBLIC_URL}"
