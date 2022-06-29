// Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-route-keys-connect-disconnect.html
// The $disconnect route is executed after the connection is closed.
// The connection can be closed by the server or by the client. As the connection is already closed when it is executed,
// $disconnect is a best-effort event.
// API Gateway will try its best to deliver the $disconnect event to your integration, but it cannot guarantee delivery.

const AWS = require("aws-sdk")

const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: process.env.AWS_REGION,
})

const { TABLE_NAME } = process.env

exports.handler = async (event) => {
  const { connectionId } = event.requestContext
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'connectionId =:connectionId',
    ExpressionAttributeValues: {
      ':connectionId': connectionId,
    },
  }
  connectionData = await ddb.query(params).promise()

  const postCalls = connectionData.Items.filter(
    (item) => item.connectionId === connectionId
  ).map(async ({ tenantId }) => {
    const deleteParams = {
      TableName: process.env.TABLE_NAME,
      Key: {
        connectionId,
        tenantId
      },
    }

    try {
      await ddb.delete(deleteParams).promise()
    } catch (err) {
      return {
        statusCode: 500,
        body: "Failed to disconnect: " + JSON.stringify(err),
      }
    }
  })
  await Promise.all(postCalls)

  return { statusCode: 200, body: "Disconnected." }
}
