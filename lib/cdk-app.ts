#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthenticatedMcpStack } from './authenticated-mcp-stack';

const app = new cdk.App();

new AuthenticatedMcpStack(app, 'AuthenticatedMcpStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
