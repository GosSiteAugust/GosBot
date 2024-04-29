const axios = require('axios');
class Server{
    async getUserData(phoneNumber){
        try {
            const response = await axios.get(`https://gosserveraugust-production.up.railway.app/user/data/${phoneNumber}`);
            return response;
        } catch (error) {
            console.log('Ошибка при получении данных с сервера:', error.response.data);
            return error.response
        }
    }
    async getUsers(){
        try {
            const response = await axios.get(`https://gosserveraugust-production.up.railway.app/user`);
            return response.data;
        } catch (error) {
            console.error('Ошибка при получении данных с сервера:', error);
            throw error;
        }
    }
}

const server = new Server();
module.exports = server