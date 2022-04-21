// Copyright 2018-2020Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')

const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION,
})

const { TABLE_NAME } = process.env

exports.handler = async (event) => {
  let connectionData
  try {
    const { message, tenantId } = JSON.parse(event.body).data
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'tenantId =:tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId,
      },
    }
    connectionData = await ddb.query(params).promise()
  } catch (e) {
    return { statusCode: 500, body: e.stack }
  }
  console.log('==============================1==========================')
  console.log('socket send message')
  console.log({ message, tenantId })
  console.log('==============================3==========================')

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });

  const { message, tenantId } = JSON.parse(event.body).data;

  const postCalls = connectionData.Items.filter(
    (item) => item.tenantId === tenantId
  ).map(async ({ connectionId }) => {
    try {
      await apigwManagementApi
        .postToConnection({ ConnectionId: connectionId, Data: message })
        .promise()
    } catch (e) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`)
        await ddb
          .delete({ TableName: TABLE_NAME, Key: { connectionId } })
          .promise()
      } else {
        throw e
      }
    }
  })

  try {
    await Promise.all(postCalls)
  } catch (e) {
    return { statusCode: 500, body: e.stack }
  }

  return { statusCode: 200, body: 'Data sent.' }
}
