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
  const { message, tenantId, command } = JSON.parse(event.body).data
  const { connectionId } = event.requestContext
  try {
    if (command === 'SET_TENANT') {
      const putParams = {
        TableName: process.env.TABLE_NAME,
        Item: {
          tenantId,
          connectionId,
        }
      }
      console.log('hi123123hihi')
      connectionData = await ddb.put(putParams).promise()
    } else {
      console.log('send message')
      const params = {
        TableName: TABLE_NAME,
        IndexName: 'tenantId-index',
        KeyConditionExpression: 'tenantId =:tenantId',
        ExpressionAttributeValues: {
          ':tenantId': tenantId,
        },
      }
      connectionData = await ddb.query(params).promise()
      const apigwManagementApi = new AWS.ApiGatewayManagementApi({
        apiVersion: "2018-11-29",
        endpoint:
          event.requestContext.domainName + "/" + event.requestContext.stage,
      })

      const postCalls = connectionData.Items.filter(
        (item) => item.tenantId === tenantId
      ).map(async ({ connectionId }) => {
        console.log({ message, tenantId })
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
      await Promise.all(postCalls)
    }
  } catch (e) {
    return { statusCode: 500, body: e.stack }
  }
  console.log('==============================1==========================')
  console.log('socket send message')
  console.log({ message, tenantId })
  console.log('==============================3==========================')

  return { statusCode: 200, body: 'Data sent.' }
}
