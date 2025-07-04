#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { McpTestStack } from '../lib/mcp-article-stack';
import * as dotenv from 'dotenv';

dotenv.config();

const app = new cdk.App();
new McpTestStack(app, 'McpArticleStack', {
  dummyBearerToken: process.env.DUMMY_BEARER_TOKEN as string,
  sessionTableName: 'mcp_session_log'
});