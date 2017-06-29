//
//  API for MoneyNetwork <=> MoneyNetwork wallet communication
//  Requirements:
// - JSEncrypt: https://github.com/travist/jsencrypt
// - cryptMessage: ZeroNet build-in plugin
// - CryptoJS: code.google.com/p/crypto-js
//
var MoneyNetworkAPI = function (options) {
    var pgm = 'new MoneyNetworkAPI: ' ;
    var sha256, moneynetwork_session_filename, wallet_session_filename ;
    options = options || {};
    this.ZeroFrame = options.ZeroFrame ;                   // inject ZeroFrame API class
    // todo: wallet true/false - could be set in a siteInfo callback. site_info.address != '1JeHa67QEvrrFpsSow82fLypw8LoRcmCXk'
    this.wallet = options.hasOwnProperty('wallet') ? options.wallet : true ; // wallet session? false for MoneyNetwork. true for MoneyNetwork wallets. default true
    this.sessionid = options.sessionid || null ;           // MoneyNetwork sessionid. Shared between MoneyNetwork and MoneyNetwork wallet session
    this.other_session_pubkey = options.pubkey || null ;   // JSEncrypt pubkey from other session (encrypt outgoing messages)
    this.other_session_pubkey2 = options.pubkey2 || null ; // cryptMessage public key from other session (encrypt outgoing messages)
    this.this_session_prvkey = options.prvkey || null ;    // JSEncrypt private key for this session (decrypt ingoing messages)
    this.this_session_userid2 = options.userid2||0 ;       // cryptMessage "userid" for this session (decrypt ingoing messages). default 0
    this.this_user_path = options.user_path ;              // user_path for this session. required for sending encrypted messages to other session
    this.this_optional = options.optional ;                // optional files pattern. add only if MoneyNetworkAPI should ensure optional files support in content.json file before sending message to other session
    this.debug = options.hasOwnProperty('debug') ? options.debug : false ;
    this.module = 'MoneyNetworkAPI' ; // for debug messages
    if (this.sessionid) {
        // setup filenames used in MoneyNetwork <=> MoneyNetwork wallet communication
        sha256 = CryptoJS.SHA256(this.sessionid).toString() ;
        moneynetwork_session_filename = sha256.substr(0,10) ; // first 10 characters of sha256 signature
        wallet_session_filename = sha256.substr(sha256.length-10); // last 10 characters of sha256 signature
        this.this_session_filename = this.wallet ? wallet_session_filename : moneynetwork_session_filename ;
        this.other_session_filename = this.wallet ? moneynetwork_session_filename : wallet_session_filename ;
    }
} ; // MoneyNetworkAPI

MoneyNetworkAPI.prototype.setup_encryption = function (options) {
    var pgm = this.module + '.setup_encryption: ' ;
    var key, missing_keys, sha256, moneynetwork_session_filename, wallet_session_filename ;
    if (options.ZeroFrame) this.ZeroFrame = options.ZeroFrame ;
    if (options.hasOwnProperty('wallet'))  this.wallet = options.wallet ;
    if (options.sessionid) this.sessionid = options.sessionid ;
    if (options.pubkey)    this.other_session_pubkey = options.pubkey ;
    if (options.pubkey2)   this.other_session_pubkey2 = options.pubkey2 ;
    if (options.prvkey)    this.this_session_prvkey = options.prvkey ;
    if (options.hasOwnProperty('userid2')) this.this_session_userid2 = options.userid2 ;
    if (options.user_path) this.this_user_path = options.user_path ;
    if (options.optional)  this.this_optional = options.optional ;
    if (options.hasOwnProperty('debug'))  this.debug = options.debug ;
    if (this.sessionid) {
        // setup filenames used in MoneyNetwork <=> MoneyNetwork wallet communication
        sha256 = CryptoJS.SHA256(this.sessionid).toString() ;
        moneynetwork_session_filename = sha256.substr(0,10) ; // first 10 characters of sha256 signature
        wallet_session_filename = sha256.substr(sha256.length-10); // last 10 characters of sha256 signature
        this.this_session_filename = this.wallet ? wallet_session_filename : moneynetwork_session_filename ;
        this.other_session_filename = this.wallet ? moneynetwork_session_filename : wallet_session_filename ;
    }
    if (!this.debug) return ;
    // debug: check encryption setup status:
    missing_keys = [] ;
    for (key in this) {
        if (['sessionid', 'other_session_pubkey', 'other_session_pubkey2', 'this_session_prvkey', 'this_session_userid2'].indexOf(key) == -1) continue ;
        if (this[key] == null) missing_keys.push(key) ;
        // else if (this.debug) console.log(pgm + key + ' = ' + this[key]) ;
    }
    if (missing_keys.length == 0) console.log(pgm + 'Encryption setup done') ;
    else console.log(pgm + 'Encryption setup: waiting for ' + missing_keys.join(', ')) ;

} ; // setup_encryption

MoneyNetworkAPI.prototype.generate_random_string = function (length, use_special_characters) {
    var character_set = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    if (use_special_characters) character_set += '![]{}#%&/()=?+-:;_-.@$|£' ;
    var string = [], index, char;
    for (var i = 0; i < length; i++) {
        index = Math.floor(Math.random() * character_set.length);
        char = character_set.substr(index, 1);
        string.push(char);
    }
    return string.join('');
}; // generate_random_string

// 1: JSEncrypt encrypt/decrypt using pubkey/prvkey
MoneyNetworkAPI.prototype.encrypt_1 = function (clear_text_1, cb) {
    var pgm = this.module + '.encrypt_1: ' ;
    var password, encrypt, key, output_wa, encrypted_text, encrypted_array ;
    if (this.debug) console.log(pgm + 'other_session_pubkey = ' + this.other_session_pubkey) ;
    if (!this.other_session_pubkey) throw pgm + 'encrypt_1 failed. pubkey is missing in encryption setup' ;
    encrypt = new JSEncrypt();
    encrypt.setPublicKey(this.other_session_pubkey);
    password = this.generate_random_string(100, true) ;
    key = encrypt.encrypt(password);
    output_wa = CryptoJS.AES.encrypt(clear_text_1, password, {format: CryptoJS.format.OpenSSL}); //, { mode: CryptoJS.mode.CTR, padding: CryptoJS.pad.AnsiX923, format: CryptoJS.format.OpenSSL });
    encrypted_text = output_wa.toString(CryptoJS.format.OpenSSL);
    encrypted_array = [key, encrypted_text] ;
    cb(JSON.stringify(encrypted_array)) ;
}; // encrypt_1
MoneyNetworkAPI.prototype.decrypt_1 = function (encrypted_text_1, cb) {
    var pgm = this.module + 'decrypt_1: ' ;
    var encrypted_array, key, encrypted_text, encrypt, password, output_wa, clear_text ;
    if (!this.this_session_prvkey) throw pgm + 'decrypt_1 failed. prvkey is missing in encryption setup' ;
    encrypted_array = JSON.parse(encrypted_text_1) ;
    key = encrypted_array[0] ;
    encrypted_text = encrypted_array[1] ;
    encrypt = new JSEncrypt();
    encrypt.setPrivateKey(this.this_session_prvkey);
    password = encrypt.decrypt(key);
    output_wa = CryptoJS.AES.decrypt(encrypted_text, password, {format: CryptoJS.format.OpenSSL}); // , { mode: CryptoJS.mode.CTR, padding: CryptoJS.pad.AnsiX923, format: CryptoJS.format.OpenSSL });
    clear_text = output_wa.toString(CryptoJS.enc.Utf8);
    cb(clear_text)
}; // decrypt_1

// 2: cryptMessage encrypt/decrypt using ZeroNet cryptMessage plugin (pubkey2)
MoneyNetworkAPI.prototype.encrypt_2 = function (encrypted_text_1, cb) {
    var pgm = this.module + '.encrypt_2: ' ;
    var self = this ;
    if (!this.ZeroFrame) throw pgm + 'encryption failed. ZeroFrame is missing in encryption setup';
    if (!this.other_session_pubkey2) throw pgm + 'encryption failed. Pubkey2 is missing in encryption setup' ;
    // 1a. get random password
    if (this.debug) console.log(pgm + 'encrypted_text_1 = ' + encrypted_text_1 + '. calling aesEncrypt') ;
    this.ZeroFrame.cmd("aesEncrypt", [""], function (res1) {
        var password ;
        password = res1[0];
        if (self.debug) console.log(pgm + 'aesEncrypt OK. password = ' + password + '. calling eciesEncrypt') ;
        // 1b. encrypt password
        self.ZeroFrame.cmd("eciesEncrypt", [password, self.other_session_pubkey2], function (key) {
            if (self.debug) console.log(pgm + 'self.other_session_pubkey2 = ' + self.other_session_pubkey2 + ', key = ' + key) ;
            // 1c. encrypt text
            if (self.debug) console.log(pgm + 'eciesEncrypt OK. calling aesEncrypt') ;
            self.ZeroFrame.cmd("aesEncrypt", [encrypted_text_1, password], function (res3) {
                var iv, encrypted_text, encrypted_array, encrypted_text_2 ;
                if (self.debug) console.log(pgm + 'aesEncrypt OK') ;
                // forward encrypted result to next function in encryption chain
                iv = res3[1] ;
                encrypted_text = res3[2];
                encrypted_array = [key, iv, encrypted_text] ;
                encrypted_text_2 = JSON.stringify(encrypted_array) ;
                if (self.debug) console.log(pgm + 'encrypted_text_2 = ' + encrypted_text_2) ;
                cb(encrypted_text_2) ;
            }) ; // aesEncrypt callback 3
        }) ; // eciesEncrypt callback 2
    }) ; // aesEncrypt callback 1
}; // encrypt_2
MoneyNetworkAPI.prototype.decrypt_2 = function (encrypted_text_2, cb) {
    var pgm = this.module + '.decrypt_2: ' ;
    var self, encrypted_array, key, iv, encrypted_text ;
    self = this ;
    if (!this.ZeroFrame) throw pgm + 'decryption failed. ZeroFrame is missing in encryption setup';
    if (this.debug) console.log(pgm + 'encrypted_text_2 = ' + encrypted_text_2) ;
    encrypted_array = JSON.parse(encrypted_text_2) ;
    key = encrypted_array[0] ;
    iv = encrypted_array[1] ;
    encrypted_text = encrypted_array[2] ;
    // 1a. decrypt key = password
    if (this.debug) console.log(pgm + 'calling eciesDecrypt') ;
    this.ZeroFrame.cmd("eciesDecrypt", [key, this.this_session_userid2], function(password) {
        if (!password) throw pgm + 'key eciesDecrypt failed. key = ' + key + ', userid2 = ' + JSON.stringify(self.this_session_userid2) ;
        // 1b. decrypt encrypted_text
        if (self.debug) console.log(pgm + 'eciesDecrypt OK. password = ' + password + ', calling aesDecrypt') ;
        self.ZeroFrame.cmd("aesDecrypt", [iv, encrypted_text, password], function (encrypted_text_1) {
            if (self.debug) console.log(pgm + 'aesDecrypt OK. encrypted_text_1 = ' + encrypted_text_1) ;
            cb(encrypted_text_1) ;
        }) ; // aesDecrypt callback 2
    }) ; // eciesDecrypt callback 1
}; // decrypt_2

// 3: symmetric encrypt/decrypt using sessionid
MoneyNetworkAPI.prototype.encrypt_3 = function (encrypted_text_2, cb) {
    var pgm = this.module + '.encrypt_3: ' ;
    if (!this.sessionid) throw pgm + 'encrypt_3 failed. sessionid is missing in encryption setup' ;
    var output_wa, encrypted_text_3 ;
    output_wa = CryptoJS.AES.encrypt(encrypted_text_2, this.sessionid, {format: CryptoJS.format.OpenSSL}); //, { mode: CryptoJS.mode.CTR, padding: CryptoJS.pad.AnsiX923, format: CryptoJS.format.OpenSSL });
    encrypted_text_3 = output_wa.toString(CryptoJS.format.OpenSSL);
    cb(encrypted_text_3) ;
}; // encrypt_3
MoneyNetworkAPI.prototype.decrypt_3 = function (encrypted_text_3, cb) {
    var pgm = this.module + '.decrypt_3: ' ;
    var output_wa, encrypted_text_2 ;
    if (!this.sessionid) throw pgm + 'decrypt_3 failed. sessionid is missing in encryption setup' ;
    output_wa = CryptoJS.AES.decrypt(encrypted_text_3, this.sessionid, {format: CryptoJS.format.OpenSSL}); // , { mode: CryptoJS.mode.CTR, padding: CryptoJS.pad.AnsiX923, format: CryptoJS.format.OpenSSL });
    encrypted_text_2 = output_wa.toString(CryptoJS.enc.Utf8);
    cb(encrypted_text_2)
}; // decrypt_3

// encrypt/decrypt json messages
// encryptions: integer or array of integers: 1 cryptMessage, 2 JSEncrypt, 3 symmetric encryption
MoneyNetworkAPI.prototype.encrypt_json = function(json, encryptions, cb) {
    var pgm = this.module + '.encrypt_json: ' ;
    var self, encryption;
    self = this ;
    if (typeof encryptions == 'number') encryptions = [encryptions];
    if (encryptions.length == 0) return cb(json); // done
    encryption = encryptions.shift();
    if (encryption == 1) {
        if (this.debug) console.log(pgm + 'this.other_session_pubkey = ' + this.other_session_pubkey) ;
        this.encrypt_1(JSON.stringify(json), function (encrypted_text) {
            json = {
                encryption: encryption,
                message: encrypted_text
            };
            self.encrypt_json(json, encryptions, cb);
        });
    }
    else if (encryption == 2) {
        if (this.debug) console.log(pgm + 'this.other_session_pubkey2 = ' + this.other_session_pubkey2) ;
        this.encrypt_2(JSON.stringify(json), function (encrypted_text) {
            json = {
                encryption: encryption,
                message: encrypted_text
            };
            self.encrypt_json(json, encryptions, cb);
        });
    }
    else if (encryption == 3) {
        if (this.debug) console.log(pgm + 'this.sessionid = ' + this.sessionid) ;
        this.encrypt_3(JSON.stringify(json), function (encrypted_text) {
            json = {
                encryption: encryption,
                message: encrypted_text
            };
            self.encrypt_json(json, encryptions, cb);
        });
    }
    else {
        console.log(pgm + 'Unsupported encryption ' + encryption);
        return cb(json);
    }
}; // encrypt_json
MoneyNetworkAPI.prototype.decrypt_json = function (json, cb) {
    var pgm = this.module + '.decrypt_json: ' ;
    var self, decrypt_json, decrypt ;
    self = this ;
    decrypt_json = self.decrypt_json ;
    if (json.encryption == 1) {
        this.decrypt_1(json.message, function (decrypted_text) {
            var json ;
            json = JSON.parse(decrypted_text) ;
            if (json.hasOwnProperty('encryption')) self.decrypt_json(json, cb) ;
            else cb(json) ; // done
        });
    }
    else if (json.encryption == 2) {
        this.decrypt_2(json.message, function (decrypted_text) {
            var json ;
            json = JSON.parse(decrypted_text) ;
            if (json.hasOwnProperty('encryption')) self.decrypt_json(json, cb) ;
            else cb(json) ; // done
        });
    }
    else if (json.encryption == 3) {
        this.decrypt_3(json.message, function (decrypted_text) {
            var json ;
            json = JSON.parse(decrypted_text) ;
            if (json.hasOwnProperty('encryption')) self.decrypt_json(json, cb) ;
            else cb(json) ; // done
        });
    }
    else {
        console.log(pgm + 'Unsupported encryption ' + json.encryption);
        return cb(json);
    }
}; // decrypt_json

// helper: get and write content.json file
MoneyNetworkAPI.prototype.get_content_json = function (cb) {
    var pgm = this.module + '.get_content_json: ' ;
    var self, inner_path ;
    self = this ;
    if (!this.this_user_path) return cb() ; // error. user_path is required
    inner_path = this.this_user_path + 'content.json' ;
    // 1: fileGet
    this.ZeroFrame.cmd("fileGet", {inner_path: inner_path, required: false}, function (content_str) {
        var content, json_raw;
        if (content_str) {
            content = JSON.parse(content_str);
            return cb(content) ;
        }
        else content = {} ;
        if (!self.this_optional) return cb(content) ; // maybe an error but optional files support was not requested
        // 2: fileWrite (empty content.json file)
        // new content.json file and optional files support requested. write + sign + get
        json_raw = unescape(encodeURIComponent(JSON.stringify(content, null, "\t")));
        self.ZeroFrame.cmd("fileWrite", [inner_path, btoa(json_raw)], function (res) {
            var pgm = self.module + '.get_content_json fileWrite callback 2: ';
            if (self.debug) console.log(pgm + 'res = ' + JSON.stringify(res));
            if (res != 'ok') return cb(); // error: fileWrite failed
            // 3: siteSign
            self.ZeroFrame.cmd("siteSign", {inner_path: inner_path}, function (res) {
                var pgm = self.module + '.get_content_json siteSign callback 3: ' ;
                if (self.debug) console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                if (res != 'ok') return cb(); // error: siteSign failed
                // 4: fileGet
                self.ZeroFrame.cmd("fileGet", {inner_path: inner_path, required: true}, function (content_str) {
                    var content;
                    if (!content_str) return cb() ; // error. second fileGet failed
                    content = JSON.parse(content_str);
                    cb(content);
                }) ; // fileGet callback 4
            }) ; // siteSign callback 3
        }) ; // fileWrite callback 2
    }); // fileGet callback 1
}; // get_content_json

// add optional files support to content.json file
MoneyNetworkAPI.prototype.add_optional_files_support = function (cb) {
    var pgm = this.module + '.add_optional_files_support: ' ;
    var self ;
    self = this ;
    if (!this.this_optional) return cb({}) ; // not checked. optional files support must be added by calling code
    // check ZeroNet state
    if (!this.ZeroFrame) return cb({error: 'Cannot add optional files support to content.json. ZeroFrame is missing in setup'}) ;
    if (!this.ZeroFrame.site_info) return cb({error: 'Cannot add optional files support to content.json. ZeroFrame is not finished loading'}) ;
    if (!this.ZeroFrame.site_info.cert_user_id) return cb({error: 'Cannot add optional files support to content.json. No cert_user_id. ZeroNet certificate is missing'}) ;
    if (!this.this_user_path) return cb({error: 'Cannot add optional files support to content.json. user_path is missing in setup'}) ;
    // ready for checking/adding optional files support in/to content.json file
    // 1: get content.json. will create empty signed content.json if content.json is missing
    this.get_content_json(function (content) {
        var json_raw ;
        if (!content) return cb({error: 'fileGet content.json failed'}) ;
        if (content.optional == self.this_optional) cb({}) ; // optional files support already OK
        // add optional files support
        content.optional = self.this_optional ;
        // 2: write content.json
        json_raw = unescape(encodeURIComponent(JSON.stringify(content, null, "\t")));
        self.ZeroFrame.cmd("fileWrite", [inner_path, btoa(json_raw)], function (res) {
            var pgm = self.module + '.add_optional_files_support fileWrite callback 2: ';
            if (self.debug) console.log(pgm + 'res = ' + JSON.stringify(res));
            if (res != 'ok') return cb({error: 'fileWrite failed. error = ' + res}); // error: fileWrite failed
            // 3: siteSign
            self.ZeroFrame.cmd("siteSign", {inner_path: inner_path}, function (res) {
                var pgm = self.module + '.add_optional_files_support siteSign callback 3: ' ;
                if (self.debug) console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                if (res != 'ok') return cb({error: 'siteSign failed. error = ' + res}); // error: siteSign failed
                // optional files support added
                cb({}) ;
            }) ; // siteSign callback 3
        }) ; // fileWrite callback 2
    }); // get_content_json callback 1
}; // add_optional_files_support

// minimum validate json before encrypt & send and after receive & decrypt using https://github.com/geraintluff/tv4
// json messages between MoneyNetwork and MoneyNetwork wallet must be valid
MoneyNetworkAPI.json_schemas = {

    "pubkeys": {
        "type": 'object',
        "title": 'Send pubkeys (JSEncrypt and cryptMessage) to other session',
        "description": 'MoneyNetwork: sends unencrypted pubkeys message to Wallet. Wallet: returns an encrypted pubkeys message to MoneyNetwork. pubkey is public key from JSEncrypt and pubkey2 is public key from cryptMessage',
        "properties": {
            "msgtype": { "type": 'string', "pattern": '^pubkeys$'},
            "pubkey": { "type": 'string'},
            "pubkey2": { "type": 'string'}
        },
        "required": ['msgtype', 'pubkey', 'pubkey2'],
        "additionalProperties": false
    }, // pubkeys

    "save_data": {
        "type": 'object',
        "title": 'Wallet: Save encrypted wallet data in MoneyNetwork',
        "description": "Optional message. Can be used to save encrypted data in an {key:value} object in MoneyNetwork localStorage.",
        "properties": {
            "msgtype": { "type": 'string', "pattern": '^save_data$'},
            "data": {
                "type": 'array',
                "items": {
                    "type": 'object',
                    "properties": {
                        "key": { "type": 'string'},
                        "value": { "type": 'string'}
                    },
                    "required": ['key'],
                    "additionalProperties": false
                },
                "minItems": 1
            }
        },
        "required": ['msgtype', 'data'],
        "additionalProperties": false
    }, // save_data

    "get_data": {
        "type": 'object',
        "title": 'Wallet: Get encrypted data from MoneyNetwork',
        "description": "Optional message. Can be used to request encrypted wallet data from MoneyNetwork localStorage",
        "properties": {
            "msgtype": { "type": 'string', "pattern": '^get_data$'},
            "keys": {
                "type": 'array',
                "items": { "type": 'string'},
                "minItems": 1
            }
        },
        "required": ['msgtype', 'keys'],
        "additionalProperties": false
    }, // get_data

    "data": {
        "type": 'object',
        "title": 'MoneyNetwork: get_data response to with requested encrypted wallet data',
        "description": "Optional message. Return requested encrypted data to wallet",
        "properties": {
            "msgtype": { "type": 'string', "pattern": '^data$'},
            "data": {
                "type": 'array',
                "items": {
                    "type": 'object',
                    "properties": {
                        "key": { "type": 'string'},
                        "value": { "type": 'string'}
                    },
                    "required": ['key'],
                    "additionalProperties": false
                }
            }
        }
    }, // data

    "delete_data": {
        "type": 'object',
        "title": 'Wallet: Delete encrypted data saved in MoneyNetwork',
        "description": "Optional message. Delete encrypted wallet data from MoneyNetwork localStorage. No keys property = delete all data",
        "properties": {
            "msgtype": { "type": 'string', "pattern": '^delete_data$'},
            "keys": {
                "type": 'array',
                "items": { "type": 'string'},
                "minItems": 1
            }
        },
        "required": ['msgtype'],
        "additionalProperties": false
    }, // delete_data

    "response": {
        "type": 'object',
        "title": 'Generic response with an optional error message',
        "properties": {
            "msgtype": { "type": 'string', "pattern": '^response$'},
            "error": { "type": 'string'}
        },
        "required": ['msgtype'],
        "additionalProperties": false
    } // receipt

} ; // json_schemas
MoneyNetworkAPI.prototype.validate_json = function (calling_pgm, json, direction) {
    var pgm = this.module + '.validate_json: ';
    var json_schema, json_error ;
    if (!json || !json.msgtype) return 'required msgtype is missing in json message' ;
    json_schema = MoneyNetworkAPI.json_schemas[json.msgtype] ;
    if (!json_schema) return 'Unknown msgtype ' + json.msgtype ;
    if (typeof tv4 === 'undefined') {
        if (this.debug) console.log(pgm + 'warning. skipping ' + json.msgtype + ' json validation. tv4 is not defined') ;
        return ;
    }
    // validate json
    if (tv4.validate(json, json_schema, pgm)) return null; // json is OK
    // report json error
    var json_error = JSON.parse(JSON.stringify(tv4.error));
    delete json_error.stack;
    return 'Error in ' + json.msgtype + ' JSON. ' +  JSON.stringify(json_error);
}; // validate_json

// send json message encrypted to other session and optional wait for response
// params:
// - json: message to send. should include a msgtype
// - options. hash with options for send_message operation
//   - response: wait for response? null, true, false or timeout (=true) in milliseconds
//   - timestamp: timestamp to be used in filename for outgoing message. Only used when sending receipts.
// - cb: callback. returns an empty hash, hash with an error messsage or response
MoneyNetworkAPI.prototype.send_message = function (request, options, cb) {
    var pgm = this.module + '.send_message: ';
    var self, response, timestamp, error, request_at, timeout_at, month, year;
    self = this;

    // get params
    if (!options) options = {};
    response = options.response;
    timestamp = options.timestamp;
    if (!cb) cb = function () {};

    // check setup
    // ZeroNet state
    if (!this.ZeroFrame) return cb({error: 'Cannot send message. ZeroFrame is missing in setup'});
    if (!this.ZeroFrame.site_info) return cb({error: 'Cannot send message. ZeroFrame is not finished loading'});
    if (!this.ZeroFrame.site_info.cert_user_id) return cb({error: 'Cannot send message. No cert_user_id. ZeroNet certificate is missing'});
    // Outgoing encryption
    if (!this.other_session_pubkey) return cb({error: 'Cannot JSEncrypt encrypt outgoing message. pubkey is missing in encryption setup'}); // encrypt_1
    if (!this.other_session_pubkey2) return cb({error: 'Cannot cryptMessage encrypt outgoing message. Pubkey2 is missing in encryption setup'}); // encrypt_2
    if (!this.sessionid) return cb({error: 'Cannot symmetric encrypt outgoing message. sessionid is missing in encryption setup'}); // encrypt_3
    if (!this.this_user_path) return cb({error: 'Cannot send message. user_path is missing in setup'});
    if (response) {
        // Ingoing encryption
        if (!this.this_session_prvkey) return cb({error: 'Cannot JSEncrypt expected ingoing receipt. prvkey is missing in encryption setup'}); // decrypt_1
        // decrypt_2 OK. cert_user_id already checked
        // decrypt_3 OK. sessionid already checked
    }

    // validate message. all messages are validated before send and after received
    // messages: pubkeys, save_data, get_data, delete_data
    error = this.validate_json(pgm, request, 'send') ;
    if (error) {
        error = 'Cannot send message. ' + error ;
        if (this.debug) {
            console.log(pgm + error);
            console.log(pgm + 'request = ' + JSON.stringify(request));
        }
        cb({error: error}) ;
    }

    // receipt?
    request_at = new Date().getTime();
    if (response) {
        // receipt requested. wait for receipt. use a random timestamp 1 year ago as receipt filename
        if (typeof response == 'number') timeout_at = request_at + response;
        else timeout_at = request_at + 10000; // timeout = 10 seconds
        year = 1000 * 60 * 60 * 24 * 365.2425;
        month = year / 12;
        response = request_at - 11 * month - Math.floor(Math.random() * month * 2);
        request = JSON.parse(JSON.stringify(request));
        request.response = response;
    }

    // 1: encrypt json
    this.encrypt_json(request, [1, 2, 3], function (encrypted_json) {
        var pgm = self.module + '.send_message encrypt_json callback 1: ';
        var user_path;
        if (self.debug) console.log(pgm + 'encrypted_json = ' + JSON.stringify(encrypted_json));
        // 2: get user_path
        user_path = self.this_user_path;
        // 3: add optional files support
        self.add_optional_files_support(function (res) {
            var pgm = self.module + '.send_message add_optional_files_support callback 3: ';
            var inner_path3, json_raw;
            if (!res || res.error) return cb({error: 'Cannot send message. Add optional files support failed. ' + JSON.stringify(res)});
            // 4: write file
            inner_path3 = user_path + self.this_session_filename + '.' + (timestamp || request_at);
            json_raw = unescape(encodeURIComponent(JSON.stringify(encrypted_json, null, "\t")));
            if (self.debug) console.log(pgm + 'writing optional file ' + inner_path3);
            self.ZeroFrame.cmd("fileWrite", [inner_path3, btoa(json_raw)], function (res) {
                var pgm = self.module + '.send_message fileWrite callback 4: ';
                var inner_path4;
                if (self.debug) console.log(pgm + 'res = ' + JSON.stringify(res));
                // 5: siteSign. publish not needed for within client communication
                inner_path4 = user_path + 'content.json';
                if (self.debug) console.log(pgm + 'sign content.json with new optional file ' + inner_path3);
                self.ZeroFrame.cmd("siteSign", {inner_path: inner_path4}, function (res) {
                    var pgm = self.module + '.send_message siteSign callback 5: ';
                    if (self.debug) console.log(pgm + 'res = ' + JSON.stringify(res));
                    if (!response) return cb({}); // exit. receipt was not requested.

                    // 6: is MoneyNetworkAPIDemon monitoring incoming messages for this sessionid?
                    MoneyNetworkAPIDemon.is_session(self.sessionid, function (is_session) {
                        var pgm = self.module + '.send_message is_session callback 6: ';
                        var get_and_decrypt, receipt_filename, error, query, wait_for_receipt ;

                        console.log(pgm + 'todo: use demon if demon process is running');
                        if (self.debug) console.log(pgm + 'is_session = ' + is_session);
                        // is_session = true

                        // fileGet and json_decrypt
                        get_and_decrypt = function (inner_path) {
                            var pgm = self.module + '.send_message.get_and_decrypt: ';
                            if (typeof inner_path != 'string') {
                                console.log(pgm + 'inner_path is not a string. inner_path = ' + JSON.stringify(inner_path)) ;
                                return cb(inner_path);
                            }
                            self.ZeroFrame.cmd("fileGet", {inner_path: inner_path, required: true}, function (response_str) {
                                var pgm = self.module + '.send_message.get_and_decrypt fileGet callback 6.1: ';
                                var encrypted_response, error;
                                if (!response_str) return cb({error: 'fileGet for receipt failed. Request was ' + JSON.stringify(request) + '. inner_path was ' + inner_path});
                                encrypted_response = JSON.parse(response_str);
                                // decrypt response
                                self.decrypt_json(encrypted_response, function (response) {
                                    var pgm = self.module + '.send_message.get_and_decrypt decrypt_json callback 6.2: ';
                                    // validate json
                                    error = self.validate_json(pgm, response, 'receive') ;
                                    if (error) {
                                        error = request.msgtype + ' response is not valid. ' + error ;
                                        if (self.debug) {
                                            console.log(pgm + error) ;
                                            console.log(pgm + 'request = ' + JSON.stringify(request)) ;
                                            console.log(pgm + 'response = ' + JSON.stringify(response)) ;
                                        }
                                        return cb({error: error}) ;
                                    }

                                    // return decrypted response
                                    if (self.debug) console.log(pgm + 'response = ' + JSON.stringify(response));
                                    cb(response);
                                }); // decrypt_json callback 6.2
                            }); // fileGet callback 6.1
                        }; // get_and_decrypt

                        receipt_filename = self.other_session_filename + '.' + response;
                        if (is_session) {
                            // demon is running and is monitoring incoming messages for this sessionid
                            error = MoneyNetworkAPIDemon.wait_for_file(receipt_filename, timeout_at, get_and_decrypt);
                            if (error) return cb({error: error});
                        }
                        else {
                            // demon is not running or demon is not monitoring this sessionid

                            // 7: wait for response. loop. wait until timeout_at
                            query =
                                "select 'merged-MoneyNetwork' || '/' || json.directory || '/'   ||  files_optional.filename as inner_path " +
                                "from files_optional, json " +
                                "where files_optional.filename = '" + receipt_filename + "' " +
                                "and json.json_id = files_optional.json_id";

                            // loop
                            wait_for_receipt = function () {
                                var pgm = self.module + '.send_message.wait_for_receipt 7: ';
                                var now;
                                now = new Date().getTime();
                                if (now > timeout_at) return cb({error: 'Timeout while waiting for receipt. Json message was ' + JSON.stringify(request) + '. Expected receipt filename was ' + receipt_filename});
                                // 7: dbQuery
                                self.ZeroFrame.cmd("dbQuery", [query], function (res) {
                                    var pgm = self.module + '.send_message.wait_for_receipt dbQuery callback 8: ';
                                    var inner_path8;
                                    if (res.error) return cb({error: 'Wait for receipt failed. Json message was ' + JSON.stringify(request) + '. dbQuery error was ' + res.error});
                                    if (!res.length) {
                                        setTimeout(wait_for_receipt, 500);
                                        return;
                                    }
                                    inner_path8 = res[0].inner_path;
                                    // 8: get_and_decryt
                                    get_and_decrypt(inner_path8);

                                }); // dbQuery callback 8
                            }; // wait_for_receipt 7
                            setTimeout(wait_for_receipt, 250);
                        } // else

                        }
                    ); // is_session callback callback 6
                }); // siteSign callback 5 (content.json)
            }); // writeFile callback 4 (request)
        }); // add_optional_files_support callback 3
    }); // encrypt_json callback 1
}; // send_message


// demon. Monitor and process incoming messages from other session
// MoneyNetwork: receive and process incoming messages from MoneyNetwork wallets
// MoneyNetwork wallets: receive and process incoming messages from MoneyNetwork
var MoneyNetworkAPIDemon = (function () {

    var module = 'MoneyNetworkAPIDemon' ;

    // init: inject ZeroFrame API into demon process
    var debug, ZeroFrame, this_session_prvkey, this_session_userid2, process_message_cb, interval ;
    function init (options) {
        var pgm = module + '.init: ' ;
        if (options.hasOwnProperty('debug')) debug = options.debug ; // true or false
        if (options.ZeroFrame) ZeroFrame = options.ZeroFrame ; // inject ZeroFrame API into demon process
        if (options.prvkey) this_session_prvkey = options.prvkey ; // JSEncrypt. decrypt incoming messages
        if (options.hasOwnProperty('userid2')) this_session_userid2 = options.userid2 ; // cryptMessage. decrypt incoming messages
        if (options.cb) process_message_cb = options.cb ; // callback to handle any incoming messages
        if (options.interval) interval = options.interval ; // milliseconds between each demon check. default 500 milliseconds
    } // init

    // wallet: false; MoneyNetwork, true: MoneyNetwork wallet
    var wallet ; // null, x, true or false
    var get_wallet_cbs = [] ; // callbacks waiting for get_wallet response
    function get_wallet (cb) {
        var pgm = module + '.get: ' ;
        if (!cb) cb = function () {} ;
        if (wallet == 'x') {
            // wait. first get_wallet request is executing
            get_wallet_cbs.push(cb) ;
            return ;
        }
        if ([true,false].indexOf(wallet) != -1) return cb(wallet) ; // ready
        // first get_wallet request. check site address and set wallet = true or false. x while executing
        wallet = 'x' ;
        ZeroFrame.cmd("siteInfo", {}, function (site_info) {
            wallet = (site_info.address != '1JeHa67QEvrrFpsSow82fLypw8LoRcmCXk') ;
            cb(wallet) ;
            while (get_wallet_cbs.length) { cb = get_wallet_cbs.shift() ; cb(wallet) }
        }) ;
    } // get_wallet

    // add session to watch list, First add session call will start a demon process checking for incoming messages
    // - session: hash with session info or api client returned from new MoneyNetworkAPI() call
    // - optional cb: function to handle incoming message. cb function must be supplied in init or
    var sessions = {} ; // other session filename => session info
    var done = {} ; // filename => cb or true. cb: callback waiting for file. true: processed
    function add_session (sessionid) {
        var pgm = module + '.add_session: ' ;
        var sha256, other_session_filename, start_demon ;
        sha256 = CryptoJS.SHA256(sessionid).toString() ;
        get_wallet(function(wallet) {
            other_session_filename = wallet ? sha256.substr(0,10) : sha256.substr(sha256.length-10) ;
            if (debug) console.log(pgm + 'sessionid = ' + sessionid + ', sha256 = ' + sha256 + ', wallet = ' + wallet + ', other_session_filename = ' + other_session_filename) ;
            if (sessions[other_session_filename]) return null ; // known sessionid
            start_demon = (Object.keys(sessions).length == 0) ;
            sessions[other_session_filename] = { sessionid: sessionid, session_at: new Date().getTime() } ;
            if (start_demon) {
                demon_id = setInterval(demon, (interval || 500)) ;
                if (debug) console.log(pgm + 'Started demon. process id = ' + demon_id) ;
            }
        }) ; // get_wallet callback
    } // add_session

    // return cb(true) if demon is monitoring incoming messages for sessionid
    function is_session (sessionid, cb) {
        var pgm = module + '.add_session: ' ;
        var sha256, other_session_filename ;
        sha256 = CryptoJS.SHA256(sessionid).toString() ;
        get_wallet(function(wallet) {
            other_session_filename = wallet ? sha256.substr(0, 10) : sha256.substr(sha256.length - 10);
            cb(sessions[other_session_filename] ? true : false) ;
        }) ;
    } // is_session

    // register callback to handle incoming message with this filename
    function wait_for_file(receipt_filename, timeout_at, cb) {
        var pgm = module + '.wait_for_message: ' ;
        if (done[receipt_filename]) return 'Error. ' + receipt_filename + ' already done or callback object already defined' ;
        done[receipt_filename] = { timeout_at: timeout_at, cb: cb} ;
        if (debug) console.log(pgm + 'added a callback function for ' + receipt_filename) ;
        return null ;
    } // wait_for_file

    var demon_id ;
    function demon() {
        var pgm = module + '.demon: ' ;
        var filename, query, session_filename, first, now ;
        // check for expired callbacks
        now = new Date().getTime();
        for (filename in done) {
            if (done[filename] == true) continue ;
            if (done[filename].timeout_at > now) continue ;
            try {
                done[filename].cb({error: 'Timeout while waiting for ' + filename}) ;
            }
            catch (e) {
                console.log(pgm + 'Error when processing incomming message ' + filename + '. error = ' + e.message)
            }
            done[filename] = true ;
        } // for i
        // find any new messages
        first = true ;
        query =
            "select json.directory, files_optional.filename " +
            "from files_optional, json " +
            "where " ;
        for (session_filename in sessions) {
            query += first ? "(" : " or " ;
            query += "files_optional.filename like '" + session_filename + ".%'"
        }
        query +=
            ") and json.json_id = files_optional.json_id " +
            "order by substr(files_optional.filename, 12)" ;
        // if (debug) console.log(pgm + 'query = ' + query) ;
        ZeroFrame.cmd("dbQuery", [query], function (res) {
            var pgm = module + '.demon dbQuery callback: ' ;
            var i, directory, filename, cb, inner_path ;
            if (res.error) {
                console.log(pgm + 'query failed. error = ' + res.error) ;
                clearInterval(demon_id);
                return ;
            }
            if (!res.length) return ;
            // process new incoming messages
            for (i=0 ; i<res.length ; i++) {
                directory = res[i].directory ;
                filename = res[i].filename ;
                if (done[filename] == true) continue ; // done
                inner_path = 'merged-MoneyNetwork/' + directory + '/' + filename ;
                // done[filename]? callback object with timeout_at and callback function waiting for this file
                cb = done[filename] ? cb = done[filename].cb : process_message_cb ;
                if (!cb) {
                    console.log(pgm + 'Error when processing incomming message ' + inner_path + '. No process callback found') ;
                    continue ;
                }
                try { cb(inner_path) }
                catch (e) {
                    console.log(pgm + 'Error when processing incomming message ' + inner_path + '. error = ' + e.message)
                }
                done[filename] = true ;
            } // for i

        }) ; // dbQuery callback

    } // demon
    
    // export MoneyNetworkAPIDemon helpers
    return {
        init: init,
        is_session: is_session,
        add_session: add_session,
        wait_for_file: wait_for_file
    };

})(); // MoneyNetworkAPIDemon

// end MoneyNetworkAPI
