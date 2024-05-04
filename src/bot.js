const { Client, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const https = require('https');
const config = require('../config/config.json');


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Reaction,],
});

const token = config.token;
let validToken = '';
const pillarDataList = []

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

});

client.on('messageCreate', async message => {
    //console.log(`Received message: ${message.content}`); // log para debug desativado para diminuir clutter no terminal
    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();


    switch (command) {
        case '!pillar':
            if (validToken === '') {
                message.channel.send('Você está deslogado. Por favor, use `!login` para logar.');
                return;
            }

            let page;
            if (args[0].toLowerCase() === 'all') {
                // pegando sequencialmente os pilares
                for (page = 0; page < 5; page++) {
                    await fetchAndSendPillarData(message, page);
                }
            } else {
                const pageNumber = parseInt(args[0]); // extrair o numero da pagina ou no caso o pilar
                if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > 5) {
                    message.channel.send('informe um pilar valido ou informe "all" para todos os pilares');
                    return;
                }
                page = pageNumber - 1; // converter numero ja que as paginas no api vao de 0 a 4 e os pilares vao de 1 a 5
                await fetchAndSendPillarData(message, page);
            }
            break;

        case '!thepillaring':
            if (validToken === '') {
                message.channel.send('Você está deslogado. Por favor, use `!login` para logar.');
                return;
            }
            await fetchAllPillarsAndSend(message);
            break;

        case '!login':
            const username = args[0]; // separar login
            const password = args.slice(1).join(' '); // separar senha

            console.log('Username:', username); // log pra teste
            console.log('Password:', password); // Log pra teste

            if (!username || !password) {
                message.channel.send('Please provide both username and password.');
                return;
            }


            // prepara o jsonn do login
            const data = JSON.stringify({ login: username });

            // post pelo https do proprio node geralmente eu utilizaria a biblioteca Axios, mas decidi fazer usando o https nativo do node
            const loginOptions = {
                hostname: 'instance.fique.online',
                port: 443,
                path: '/webhook/merge/88d8701e-a1d6-4fee-b15b-53e90dc1d126/autenticacao/57441afd5a59ccd4c62816683fcc8d665c42bb7b12857fc64a6cace4ababdc67f78c70b044',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length,
                    'Authorization': 'Basic ' + Buffer.from(username + ':' + password).toString('base64')
                }
            };

            // faz o post do login
            const loginReq = https.request(loginOptions, (res) => {
                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    try {
                        console.log('Login response data:', responseData);
                        const responseJson = JSON.parse(responseData);

                        if (responseJson.code === 401 && responseJson.message === "inavlid_credentials") {
                            console.log('Invalid credentials');
                            message.channel.send('Credenciais inválidas');
                            return;
                        }

                        if (responseJson.api_token) {
                            validToken = responseJson.api_token; // salva o token
                            console.log('Acesso Permitido usuario logado');
                            message.channel.send('Acesso Permitido');
                        } else {
                            console.error('retorno desconhecido:', responseJson);
                            message.channel.send('Retorno desconhecido.');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        message.channel.send('erro com o login.');
                    }
                });
            });

            loginReq.on('error', (error) => {
                console.error('Error:', error);
                message.channel.send('Erro com o login.');
            });

            loginReq.write(data);
            loginReq.end();
            break;

        default:
            break;
    }
});


async function fetchAllPillarsAndSend(message) {
    try {
        const pillarDataList = [];

        // pega os pillares
        for (let page = 0; page < 5; page++) {
            const options = {
                hostname: 'instance.fique.online',
                port: 443,
                path: `/webhook/merge/88d8701e-a1d6-4fee-b15b-53e90dc1d126/listar_pilares/76b07f1dbf18eabde7b8e3611ab078daa0f34b094cc9856d20d6d0b15fb3b7a99f697e451d?page=${page}&api_token=${validToken}`,
                method: 'GET',
            };

            const responseData = await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    let responseData = '';
                    res.on('data', (chunk) => {
                        responseData += chunk;
                    });
                    res.on('end', () => {
                        resolve(responseData);
                    });
                });

                req.on('error', (error) => {
                    console.error('Error:', error);
                    reject(error);
                });

                req.end();
            });

            const responseJson = JSON.parse(responseData);
            pillarDataList.push(responseJson.data);
        }

        // combina a informação dos pilares
        const combinedData = pillarDataList.join('');
        console.log('Combined data:', combinedData);

        // envia utilizando a funçao nova.
        await sendCombinedData(combinedData, validToken);
        message.channel.send('Resposta enviada com sucesso.');
    } catch (error) {
        console.error('Error processing Pillar data:', error);
        message.channel.send('Ocorreu um erro ao processar os dados do pilar.');
    }
}


async function sendCombinedData(combinedData, validToken) {
   //junta e transforma em base64 a data combinada e a envia retornando
    const base64Data = Buffer.from(combinedData).toString('base64');
    const data = JSON.stringify({ answer: base64Data }); 
    const options = {
        hostname: 'instance.fique.online',
        port: 443,
        path: `/webhook/merge/88d8701e-a1d6-4fee-b15b-53e90dc1d126/envia_resposta/7b56940678e89802e02e1981a8657206d639f657d4c58efb8d8fb74814799d1c001ec121c6?api_token=${validToken}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                console.log('Response from POST request:', responseData); // loga o retorno
                resolve({ statusCode: res.statusCode, body: responseData });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}


async function fetchAndSendPillarData(message, page) {
    const options = {
        hostname: 'instance.fique.online',
        port: 443,
        path: `/webhook/merge/88d8701e-a1d6-4fee-b15b-53e90dc1d126/listar_pilares/76b07f1dbf18eabde7b8e3611ab078daa0f34b094cc9856d20d6d0b15fb3b7a99f697e451d?page=${page}&api_token=${validToken}`,
        method: 'GET',
    };

    const responseData = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                resolve(responseData);
            });
        });

        req.on('error', (error) => {
            console.error('Error:', error);
            reject(error);
        });

        req.end();
    });

    try {
        console.log('Resposta da ', page, ':', responseData);
        const responseJson = JSON.parse(responseData);
        console.log('Retorno:', responseJson);
        message.channel.send(`Pillar ${page + 1}: ${responseJson.data}`);
    } catch (error) {
        console.error('Error:', error);
        message.channel.send('Um erro ocorreu :C.');
    }
}

client.login(token);


