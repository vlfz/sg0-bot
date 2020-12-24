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

const { stringify } = require('querystring');
const fetch = require('node-fetch');

const con = require('mysql').createPool({
    host: process.env.db_host, port: 3306, insecureAuth: true,
    user: process.env.db_user, password: process.env.db_password,
    database: process.env.db_user, charset: "utf8mb4"
});

module.exports = {
    isAuthorized: (user_id) =>
        new Promise((resolve, reject) =>
            con.query("SELECT * FROM users WHERE user_id = ?", [user_id], (err, users) => {
                if(err) {
                    console.error(err.stack);
                    return resolve({ ok: false, self: true });
                }

                if(!users[0]) return resolve({ ok: false, self: false });
                return resolve({ ok: true, data: users[0] });
            })
        ),
    auth: (user_id, data) =>
        new Promise((resolve, reject) => {
            let userData = {};
            return fetch(`${process.env.baseUrl}/connect/token`, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                method: "POST",
                body: stringify({
                    client_id: process.env.clientId,
                    client_secret: process.env.clientSecret,
                    scope: process.env.scope,
                    grant_type: "password",

                    username: data.login,
                    password: data.password
                })
            }).then(r => r.json()).then(r => {
                userData.authorization = r;
                return fetch(`${process.env.coreUrl}/UserService/GetUserServersList`, {
                    headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `${r.token_type} ${r.access_token}` },
                    method: "POST",
                    body: stringify({})
                }).then(r => r.json()).then(r => {
                    userData.server = r.servers[0];
                    if(!userData.server) return resolve({ ok: false, step: 2, self: false });

                    return fetch(`${userData.server.serverUrl}/Api/v2/Data/GetStudentSchoolList`, {
                        headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `${userData.authorization.token_type} ${userData.authorization.access_token}` },
                        method: "POST",
                        body: stringify({
                            "UserId": userData.server.userId
                        })
                    }).then(r => r.json()).then(r => {
                        userData.user = r[0];
                        if(!userData.user) return resolve({ ok: false, step: 3, self: false });
                        
                        userData.school = userData.user['sсhools'][0];
                        if(!userData.school) return resolve({ ok: false, step: 3, self: false });
                        userData.years = userData.school.schoolYears;
                        
                        return con.query(
                            "INSERT INTO users (user_id, login, access_token, refresh_token, token_type, school_id, school_currentYear, school_user_id, school_gateway) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            [
                                user_id, data.login,
                                userData.authorization.access_token,
                                userData.authorization.refresh_token,
                                userData.authorization.token_type,
                                userData.school.schoolId, userData.years[userData.years.length - 1].id,
                                userData.user.studentId, userData.server.serverUrl
                            ], (err) => {
                                if(err) {
                                    console.error(err.stack);
                                    return resolve({ ok: false, step: 4, self: true });
                                }

                                return resolve({ ok: true });
                            }
                        );
                    }).catch(e => {
                        console.error(e.stack);
                        return resolve({ ok: false, step: 3, self: true });
                    });
                }).catch(e => {
                    console.error(e.stack);
                    return resolve({ ok: false, step: 2, self: true });
                })
            }).catch(e => {
                console.error(e.stack);
                return resolve({ ok: false, step: 1, self: true });
            })
        }),
    unauth: (user_id) =>
        new Promise((resolve, reject) =>
            con.query("DELETE FROM users WHERE user_id = ?", [user_id], (err) => {
                if(err) {
                    console.error(err.stack);
                    return resolve({ ok: false, self: true });
                }

                return resolve({ ok: true });
            })
        ),
    getUsers: () =>
        new Promise((resolve, reject) =>
            con.query("SELECT * FROM users", (err, users) => {
                if(err) {
                    console.error(err.stack);
                    return resolve({ ok: false, self: true });
                }

                return resolve(users);
            })
        ),
    refreshToken: (user_id, token) =>
        new Promise((resolve, reject) =>
            fetch(`${process.env.baseUrl}/connect/token`, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                method: "POST",
                body: stringify({
                    client_id: process.env.clientId,
                    client_secret: process.env.clientSecret,
                    grant_type: "refresh_token",
                    refresh_token: token
                })
            }).then(r => r.json()).then(r =>
                con.query("UPDATE users SET access_token = ?, refresh_token = ? WHERE user_id = ?", [r.access_token, r.refresh_token, user_id], (err, users) => {
                    if(err) {
                        console.error(err.stack);
                        return resolve({ ok: false, self: true });
                    }
                })
            ).catch(e => {
                console.error(e.stack);
                return resolve({ ok: false, self: true });
            })
        ),
    getTotals: (user_id) =>
        new Promise((resolve, reject) =>
            con.query("SELECT * FROM users WHERE user_id = ?", [user_id], (err, users) => {
                if(err) {
                    console.error(err.stack);
                    return resolve({ ok: false, self: true });
                }

                return fetch(`${users[0].school_gateway}/Api/v2/Data/GetTotals`, {
                    headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `${users[0].token_type} ${users[0].access_token}` },
                    method: "POST",
                    body: stringify({
                        "CurrentUserId": users[0].school_user_id,
                        "SchoolYearId": users[0].school_currentYear
                    })
                }).then(r => r.json()).then(resolve).catch(e => {
                    console.error(e.stack);
                    return resolve({ ok: false, self: true });
                });
            })
        )
}