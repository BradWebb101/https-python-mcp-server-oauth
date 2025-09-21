#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { McpTestStack } from '../lib/mcp-article-stack';

const app = new cdk.App();
new McpTestStack(app, 'McpArticleStack', {
  sessionTableName: 'mcp_session_log'
});