/**
 * MIT License
 * Copyright (c) 2020 https://github.com/vlfz
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 **/

require('dotenv-flow').config();
const pkg = require('./package');
const emojis = require('./emojis');

Date.prototype.getPrevWeek = function() {
    return new Date(this.getFullYear(), this.getMonth(), this.getDate() - 7);
};

Date.prototype.getNextWeek = function() {
    return new Date(this.getFullYear(), this.getMonth(), this.getDate() + 7);
};

Date.prototype.getWeekStart = function() {
    return new Date(this.getFullYear(), this.getMonth(), this.getDate() + (1 - this.getDay()));
};

Date.prototype.getWeekEnd = function() {
    return new Date(this.getFullYear(), this.getMonth(), this.getDate() + (7 - this.getDay()));
};

const con = require('./database');
const VK = require('node-vk-bot-api');
const bot = new VK({
    token: process.env.vk_token,
    group_id: process.env.vk_groupId,
    execute_timeout: 50,
    polling_timeout: 25
});

bot.on(async (ctx) => {
    ctx.message.content = ctx.message.text || ctx.message.body;
    ctx.message.authorID = ctx.message.user_id || ctx.message.from_id;
    
    ctx.message.dm = false;
    if(ctx.message.from_id && !ctx.message.user_id) ctx.message.dm = true;

    if(ctx.message.content.indexOf(process.env.prefix) !== 0) return;
    const args = ctx.message.content.slice(process.env.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command == "войти") {
        if(ctx.message.dm == false)
            return ctx.reply(`${emojis.error} Эээ.. Зачем другим знать ваши данные? Напишите мне в личные сообщения!`);

        let isAuthorized = await con.isAuthorized(ctx.message.authorID);
        if(isAuthorized.ok == true)
            return ctx.reply(`${emojis.error} Эээ.. Зачем вам заново входить в свой аккаунт?`);

        let data = { login: args[0], password: args[1] }
        if(!data.login || !data.password)
            return ctx.reply(`${emojis.error} Эээ.. Вам нужно указать логин/пароль от Мобильный ID ИРТех (нет, не те данные, что вам дали в образовательном учереждении).`);

        let steps = {
            1: "авторизация через Мобильный ID ИРТех",
            2: "получение школы пользователя",
            3: "получение информации о пользователе",
            4: "сохранение информации в базу данных"
        };

        try {
            let tryingAuthorization = await con.auth(ctx.message.authorID, data);
            if(tryingAuthorization.ok == false)
                return ctx.reply(`${emojis.error} Упс.. Произошла ошибка при попытке авторизации..\n\nЭтап: ${steps[tryingAuthorization.step]}\nОшибка вызвана системой: ${(tryingAuthorization.self == true) ? emojis.ok : emojis.error}`);
            else if(tryingAuthorization.ok == true)
                return ctx.reply(`${emojis.ok} Еху! Вы только что авторизовались в своём аккаунте!`);
        } catch (e) {
            console.error(e.stack);
            return ctx.reply(`${emojis.error} Ой.. Что-то пошло не так. Обратитесь к ${pkg.author.name}: ${pkg.author.url}`);
        }
    }

    if(command == "выйти") {
        if(ctx.message.dm == false)
            return ctx.reply(`${emojis.error} Эээ.. В целях безопасности, выход из аккаунта невозможен через чат. Напишите мне в личные сообщения!`);

        let isAuthorized = await con.isAuthorized(ctx.message.authorID);
        if(isAuthorized.ok == false)
            return ctx.reply(`${emojis.error} Эээ.. Зачем выходить из несуществующего аккаунта?`);

        try {
            let tryingUnauthorization = await con.unauth(ctx.message.authorID);
            if(tryingUnauthorization.ok == false)
                return ctx.reply(`${emojis.error} Упс.. Произошла ошибка при попытке де-авторизации..\n\nОшибка вызвана системой: ${(tryingAuthorization.self == true) ? emojis.ok : emojis.error}`);
            else if(tryingUnauthorization.ok == true)
                return ctx.reply(`${emojis.ok} Вы вышли из своего аккаунта.`);
        } catch (e) {
            console.error(e.stack);
            return ctx.reply(`${emojis.error} Ой.. Что-то пошло не так. Обратитесь к ${pkg.author.name}: ${pkg.author.url}`);
        }
    }

    if(command == "итоги") {
        if(ctx.message.dm == false)
            return ctx.reply(`${emojis.error} Эээ.. Зачем другим знать ваши данные? Напишите мне в личные сообщения!`);

        let isAuthorized = await con.isAuthorized(ctx.message.authorID);
        if(isAuthorized.ok == false)
            return ctx.reply(`${emojis.error} Эээ.. Вы не авторизованы..`);

        try {
            let getTotals = await con.getTotals(ctx.message.authorID);
            if(getTotals.ok == false)
                return ctx.reply(`${emojis.error} Упс.. Произошла ошибка при попытке получения информации..\n\nОшибка вызвана системой: ${(tryingAuthorization.self == true) ? emojis.ok : emojis.error}`);
            else {
                if(args[0] && (Number(args[0]) <= 0 || Number(args[0]) >= 5))
                    return ctx.reply(`${emojis.error} Эээ.. Четвертей бывает всего 4. :/`);

                let marks = [
                    `[!] Оценки выводятся в таком формате: "ПРЕДМЕТ: ОЦЕНКА"`,
                    (args[0] && Number(args[0])) ? `Сортировка: ${args[0]} четверть` : `Чтобы получить конкретно за какую-то четверть, допишите число от 1 до 4`,
                    ``
                ];

                for (let subject of getTotals) {
                    let allMarks;
                    if(args[0]) allMarks = subject.termsMark.filter( x => x.name == `${args[0]} ч.` );
                    else allMarks = subject.termsMark.filter( x => x.mark !== null );

                    marks.push(`${subject.subjectName}: ${allMarks.map( x => {
                        if(args[0]) return ` ${x.mark || "?"}`;
                        else return ` ${x.name} (${x.mark || "?"})`;
                    } )}`);
                }

                return ctx.reply( marks.join("\n") );
            }
        } catch (e) {
            console.error(e.stack);
            return ctx.reply(`${emojis.error} Ой.. Что-то пошло не так. Обратитесь к ${pkg.author.name}: ${pkg.author.url}`);
        }
    }

    if(command == "time") {
        let date = new Date();
        let msg = [
            date.getPrevWeek(),
            date.getNextWeek(),
            date.getWeekStart(),
            date.getWeekEnd()
        ];

        return ctx.reply( msg.join("\n") );
    }
});

bot.startPolling(async (err) => {
    if(err) return console.error(err.stack);

    setInterval(async () => {
        let users = await con.getUsers();
        for (let user of users) { con.refreshToken(user.user_id, user.refresh_token); }
    }, 1200 * 1000);

    return console.info(`* ${pkg.name} (v${pkg.version}) is started!`);
});