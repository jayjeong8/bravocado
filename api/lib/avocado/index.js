/**
 * 아보카도 모듈 re-export
 */

const parser = require('./parser');
const validation = require('./validation');
const messages = require('./messages');
const transfer = require('./transfer');

module.exports = {
    // parser.js
    countAvocados: parser.countAvocados,
    extractMentions: parser.extractMentions,
    parseAvocadoMessage: parser.parseAvocadoMessage,

    // validation.js
    DEFAULT_DAILY_AVOCADOS: validation.DEFAULT_DAILY_AVOCADOS,
    getRemainingAvocados: validation.getRemainingAvocados,
    canDistribute: validation.canDistribute,
    excludeSender: validation.excludeSender,

    // messages.js
    formatRecipientList: messages.formatRecipientList,
    buildReceiverDM: messages.buildReceiverDM,
    buildSenderSuccessMessage: messages.buildSenderSuccessMessage,
    buildErrorMessage: messages.buildErrorMessage,

    // transfer.js
    transferToRecipient: transfer.transferToRecipient,
    executeTransfers: transfer.executeTransfers,
};
