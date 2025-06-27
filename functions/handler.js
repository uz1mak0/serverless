'use strict';

require('dotenv').config();

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Constants
const ITEMS_TABLE = process.env.itemsTable;
const WAREHOUSES_TABLE = process.env.warehousesTable;
const TRANSACTIONS_TABLE = process.env.transactionsTable;
const INVENTORY_TABLE = process.env.inventoryTable;

// Helper function to generate unique IDs
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Item Management
const createItem = async (item) => {
 try {
  const params = {
    TableName: ITEMS_TABLE,
    Item: {
      id: generateId(),
      ...item,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
  };
  await dynamoDB.put(params).promise();
  return params.Item;
 }catch(e){
    throw new Error("There's an error creating item");
 } 
};

// Warehouse Management
const createWarehouse = async (warehouse) => {
  try {
    const params = {
      TableName: WAREHOUSES_TABLE,
      Item: {
        id: generateId(),
        ...warehouse,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };
    await dynamoDB.put(params).promise();
    return params.Item;
  }catch(e){
    throw new Error("There's an error creating new warehouse_id");
  }
};

// Transaction Management
const createTransaction = async (transaction) => {
  try {
    const transactionId = generateId();
    const params = {
      TableName: TRANSACTIONS_TABLE,
        Item: {
          id: transactionId,
          ...transaction,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
  };
  await dynamoDB.put(params).promise();
  return params.Item;
  }catch(e){
    throw new Error("There's an error creating new transaction");
  }
};

// Inventory Movement (Transmittal/Pullout)
const moveInventory = async (movement) => {
  const { warehouse_id, items, type } = movement;
  
  // Start a transaction
  const transaction = {
    warehouse_id,
    type,
    items,
    status: 'PENDING',
    created_at: new Date().toISOString()
  };

  // Create the transaction record
  const transactionRecord = await createTransaction(transaction);

  // Update inventory for each item
  for (const item of items) {
    const inventoryParams = {
      TableName: INVENTORY_TABLE,
      Key: {
        warehouse_id,
        item_id: item.id
      },
      UpdateExpression: type === 'TRANSMITTAL' 
        ? 'SET quantity = quantity + :qty'
        : 'SET quantity = quantity - :qty',
      ExpressionAttributeValues: {
        ':qty': item.quantity
      },
      ReturnValues: 'ALL_NEW'
    };

    await dynamoDB.update(inventoryParams).promise();
  }

  // Update transaction status
  await dynamoDB.update({
    TableName: TRANSACTIONS_TABLE,
    Key: { id: transactionRecord.id },
    UpdateExpression: 'SET status = :status',
    ExpressionAttributeValues: {
      ':status': 'COMPLETED'
    } 
  }).promise();

  return transactionRecord;
};

// Main handler
module.exports.user = async (event) => {

  try {
    const { action, data } = JSON.parse(event.body);

    switch (action) {
      case 'createItem':
        return {
          statusCode: 200,
          body: JSON.stringify(await createItem(data))
        };

      case 'createWarehouse':
        return {
          statusCode: 200,
          body: JSON.stringify(await createWarehouse(data))
        };

      case 'createTransaction':
        return {
          statusCode: 200,
          body: JSON.stringify(await createTransaction(data))
        };

      case 'transmitItems':
        return {
          statusCode: 200,
          body: JSON.stringify(await moveInventory({ ...data, type: 'TRANSMITTAL' }))
        };

      case 'pulloutItems':
        return {
          statusCode: 200,
          body: JSON.stringify(await moveInventory({ ...data, type: 'PULLOUT' }))
        };

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Invalid action' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};