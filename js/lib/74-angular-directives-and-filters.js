angular.module('MoneyNetwork')

    // catch key enter event in user info table (insert new empty row in table)
    // also cacthing on key tab event for last row in table (insert row empty row at end of table)
    // used for UserCtl.insert_row. also used for save new alias efter edit
    .directive('onKeyEnter', ['$parse', function($parse) {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {
                element.bind('keydown keypress', function(event) {
                    // console.log('onKeyEnter: event.which = ' + event.which) ;
                    if ((event.which === 13) || ((event.which === 9) && scope.$last)) {
                        var attrValue = $parse(attrs.onKeyEnter);
                        (typeof attrValue === 'function') ? attrValue(scope) : angular.noop();
                        event.preventDefault();
                    }
                });
                scope.$on('$destroy', function() {
                    element.unbind('keydown keypress')
                })
            }
        };
    }])

    // cancel edit alias
    .directive('onKeyEscape', ['$parse', function($parse) {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {
                element.bind('keydown keypress', function(event) {
                    // console.log('onKeyEscape: event.which = ' + event.which) ;
                    if (event.which === 27) {
                        var attrValue = $parse(attrs.onKeyEscape);
                        (typeof attrValue === 'function') ? attrValue(scope) : angular.noop();
                        event.preventDefault();
                    }
                });
                element.bind('blur', function (event) {
                    // console.log('onKeyEscape: event.which = ' + event.which) ;
                    var attrValue = $parse(attrs.onKeyEscape);
                    (typeof attrValue === 'function') ? attrValue(scope) : angular.noop();
                    event.preventDefault();
                });
                scope.$on('$destroy', function() {
                    element.unbind('keydown keypress blur');
                })
            }
        };
    }])


    // http://wisercoder.com/drag-drop-image-upload-directive-angular-js/
    .directive("imagedrop", function ($parse, $document) {
        return {
            restrict: "A",
            link: function (scope, element, attrs) {
                var pgm = 'imagedrop/link: ' ;
                // console.log(pgm + 'scope   = ' + JSON.stringify(scope));
                // console.log(pgm + 'element = ' + JSON.stringify(element));
                // console.log(pgm + 'attrs   = ' + JSON.stringify(attrs));
                var onImageDrop = $parse(attrs.onImageDrop);
                // console.log(pgm + 'onImageDrop = ' + JSON.stringify(onImageDrop));

                //When an item is dragged over the document
                var onDragOver = function (e) {
                    e.preventDefault();
                    angular.element('body').addClass("dragOver");
                };

                //When the user leaves the window, cancels the drag or drops the item
                var onDragEnd = function (e) {
                    e.preventDefault();
                    angular.element('body').removeClass("dragOver");
                };

                //When a file is dropped
                var loadFile = function (file) {
                    scope.uploadedFile = file;
                    scope.$apply(onImageDrop(scope));
                };

                //Dragging begins on the document
                $document.bind("dragover", onDragOver);

                //Dragging ends on the overlay, which takes the whole window
                element.bind("dragleave", onDragEnd)
                    .bind("drop", function (e) {
                        var pgm = 'imagedrop/dragleave/drop: ' ;
                        onDragEnd(e);
                        // console.log(pgm + 'e.originalEvent.dataTransfer.files.length = ' + e.originalEvent.dataTransfer.files.length);
                        // console.log(pgm + 'typeof e.originalEvent.dataTransfer.files[0] = ' + typeof e.originalEvent.dataTransfer.files[0]);
                        // console.log(pgm + 'e.originalEvent.dataTransfer.files[0] = ' + JSON.stringify(e.originalEvent.dataTransfer.files[0]));
                        loadFile(e.originalEvent.dataTransfer.files[0]);
                    });
            }
        };
    })

    .filter('toJSON', [function () {
        // debug: return object as a JSON string
        return function (object) {
            return JSON.stringify(object) ;
        } ;
        // end toJSON filter
    }])

    .filter('toJSONWithSpaces', [function () {
        // debug: return object as a JSON string
        return function (object) {
            var str = JSON.stringify(object) ;
            var str = str.split('":"').join('": "');
            var str = str.split('","').join('", "');
            return str ;
            if (str.length > 40) str = str.substr(0,40) ;
            return str ;
        } ;
        // end toJSON filter
    }])

    .filter('shortCertUserId', [function () {
        // return part of cert_user_id before @
        return function (cert_user_id) {
            var i = cert_user_id.indexOf('@') ;
            return cert_user_id.substr(0,i) ;
        } ;
        // end shortCertUserId filter
    }])

    .filter('aliasOrShortCertUserId', [function () {
        // return part of cert_user_id before @
        return function (contact) {
            if (!contact) return '' ;
            if (contact.alias) return contact.alias ;
            var i = contact.cert_user_id.indexOf('@') ;
            return contact.cert_user_id.substr(0,i) ;
        } ;
        // end aliasOrShortCertUserId filter
    }])

    .filter('findContactAvatar', [function () {
        // return part of cert_user_id before @
        return function (contact) {
            if (!contact) return '' ;
            if (['jpg','png'].indexOf(contact.avatar) != -1) {
                // contact with uploaded avatar
                return 'data/users/' + contact.auth_address + '/avatar.' + contact.avatar ;
            }
            // must be contact with a random assigned avatar
            return 'public/images/avatar' + contact.avatar ;
        } ;
        // end findContactAvatar filter
    }])

    .filter('formatMsgSize', ['MoneyNetworkService', function (moneyNetworkService) {
        // return msg disk usage: format localStorage size [ / ZeroNet size bytes ]
        // note that encryption overhead is not included in localStorage size
        var ls_msg_factor = Math.abs(moneyNetworkService.get_ls_msg_factor()) ;
        return function (message) {
            var pgm = 'formatMsgSize: ' ;
            var ls_msg_size = Math.round(message.ls_msg_size * ls_msg_factor) ;
            var z_msg_size ;
            // console.log(pgm + 'message = ' + JSON.stringify(message));
            if (message.folder == 'outbox') {
                z_msg_size = message.zeronet_msg_size || 0 ;
                return ls_msg_size + '/' + z_msg_size + ' bytes' ;
            }
            else return ls_msg_size + ' bytes' ;
        } ;
        // end shortChatTime filter
    }])

    .filter('shortChatTime', ['$filter', function ($filter) {
        // short format for unix timestamp used in chat
        return function (unix_timestamp) {
            var pgm = 'shortChatTime filter: ' ;
            var today = new Date ;
            var date = new Date(unix_timestamp) ;
            // today?
            if (today.getDate() == date.getDate()) return $filter('date')(date, 'shortTime');
            // not today: use format minutes, hours, days, weeks, months, years ago
            var miliseconds_ago = today - date ;
            var seconds_ago = miliseconds_ago / 1000 ;
            if (seconds_ago < 59.5) {
                seconds_ago = Math.round(seconds_ago) ;
                if (seconds_ago == 1) return '1 second ago' ;
                else return seconds_ago + ' seconds ago' ;
            }
            var minutes_ago = seconds_ago / 60 ;
            if (minutes_ago < 59.5) {
                minutes_ago = Math.round(minutes_ago) ;
                if (minutes_ago == 1) return '1 minute ago' ;
                else return minutes_ago + ' minutes ago' ;
            }
            var hours_ago = minutes_ago / 60 ;
            if (hours_ago < 23.5) {
                hours_ago = Math.round(hours_ago) ;
                if (hours_ago == 1) return '1 hour ago' ;
                else return hours_ago + ' hours ago' ;
            }
            var days_ago = hours_ago / 24 ;
            if (days_ago < 6.5) {
                days_ago = Math.round(days_ago);
                if (days_ago == 1) return '1 day ago' ;
                else return days_ago + ' days ago' ;
            }
            var weeks_ago = days_ago / 7 ;
            if (weeks_ago < 4.35) {
                weeks_ago = Math.round(weeks_ago);
                if (weeks_ago == 1) return '1 week ago' ;
                else return weeks_ago + ' weeks ago' ;
            }
            var months_ago = days_ago / 365 * 12 ;
            if (months_ago < 11.5) {
                months_ago = Math.round(months_ago);
                if (months_ago == 1) return '1 month ago' ;
                else return months_ago + ' months ago' ;
            }
            var years_ago = days_ago / 365 ;
            years_ago = Math.round(years_ago) ;
            if (years_ago == 1) return '1 year ago' ;
            else return years_ago + ' years ago' ;
        } ;
        // end shortChatTime filter
    }])

    // format special tag values. Last Updated
    .filter('formatSearchValue', ['shortChatTimeFilter', function (shortChatTime) {
        // short format for unix timestamp used in chat
        return function (row) {
            var pgm = 'formatSearchValue: ' ;
            if (row.tag != 'Last updated') return row.value ;
            if (typeof row.value != 'number') return row.value ;
            return shortChatTime(row.value*1000) ;
        } ;
        // end formatSearchValue filter
    }])

    // format special tag values. Last Updated
    .filter('formatSearchTitle', ['dateFilter', function (date) {
        // short format for unix timestamp used in chat
        return function (row) {
            var pgm = 'formatSearchValue: ' ;
            if (row.tag != 'Last updated') return row.value ;
            if (typeof row.value != 'number') return row.value ;
            return date(row.value*1000, 'short') ;
        } ;
        // end formatSearchTitle filter
    }])

    .filter('formatChatMessage', [function () {
        // return part of cert_user_id before @
        return function (message) {
            // find receiver
            var pgm = 'formatChatMessage: ' ;
            // console.log(pgm + 'message = ' + JSON.stringify(message));
            var setup, alias, greeting, i ;
            if (message.message.folder == 'inbox') {
                // inbox: received message from contact
                setup = JSON.parse(MoneyNetworkHelper.getItem('setup')) ;
                alias = setup.alias;
                greeting = 'Hi ' + alias ;
            }
            else {
                // outbox: send message to contact
                if (message.contact.alias) alias = message.contact.alias ;
                else {
                    i = message.contact.cert_user_id.indexOf('@') ;
                    alias = message.contact.cert_user_id.substr(0,i) ;
                }
                greeting = 'Hello ' + alias;
            }
            // check known message types
            var str, msgtype, search ;
            msgtype = message.message.message.msgtype ;
            // console.log(pgm + 'msgtype = ' + msgtype);
            if (msgtype == 'contact added') {
                // send or receive ekstra contact information
                search = message.message.message.search ;
                str = 'I added you as contact.' ;
                if (search.length > 0) {
                    str = str + ' My user information is: ' ;
                    for (i=0 ; i<search.length ; i++) {
                        if (i==0) null ;
                        else if (i==search.length-1) str = str + ' and ' ;
                        else str = str + ', ';
                        str = str + '"' + search[i].tag + '": "' + search[i].value + '"' ;
                    } // for i
                }
                str = greeting + '. ' + str ;
                // console.log('str = ' + str) ;
                return str ;
            }
            if (msgtype == 'contact removed') return greeting + '. I removed you as contact' ;
            if (msgtype == 'chat msg') return greeting + '. ' + message.message.message.message ;
            if (msgtype == 'verify') {
                // contact verification request. Different presentation for inbox/outbox and status for verification (pending or verified)
                if (message.message.folder == 'outbox') {
                    // sent verification request to contact
                    return 'Sent verification message to ' + alias + '. Secret verification password is "' +
                        message.message.password + '". You must send secret password to ' + alias +
                        ' in an other secure communication channel (mail, social network etc). Status: waiting for verification.';
                }
                else {
                    str =
                        greeting + '. I want to add you to my list of verified contacts. ' +
                        'Please enter the secret verification password that you receive in an other communication channel.' ;
                    if (message.message.password_sha256) str = str + " Status: pending" ;
                    else str = str + " Status: verified" ;
                    return str ;
                }
            }
            if (msgtype == 'verified') {
                // contact verification response.
                return greeting + '. That is OK. The verification password is "' + message.message.message.password + '".' ;
            }
            if (msgtype == 'received') {
                // receipt for chat message with image. Used for quick data.json cleanup to free disk space in users directory
                return greeting + '. Thank you. I have received your photo.' ;
                if (message.message.folder == 'outbox') {
                    // sent receipt for chat message with to contact
                }
                else {
                    // received receipt for chat message with image from contact
                }
            }
            // other "unknown" messages. Just return JSON dump
            str = JSON.stringify(message.message) ;
            str = str.split('":"').join('": "');
            str = str.split('","').join('", "');
            return greeting + '. ' + str ;
        } ;
        // end formatChatMessage filter
    }])

    .filter('chatEditFormName', [function () {
        // return part of cert_user_id before @
        return function (message) {
            // find receiver
            var hash_key = message['$$hashKey'] ;
            var object_id = hash_key.split(':')[1] ;
            var form_name = 'edit_chat_msg_form_' + object_id ;
            return form_name ;
        } ;
        // end chatEditFormName filter
    }])

    .filter('chatEditTextAreaId', [function () {
        // return part of cert_user_id before @
        return function (message) {
            // find receiver
            var hash_key = message['$$hashKey'] ;
            var object_id = hash_key.split(':')[1] ;
            var id = 'edit_chat_msg_text_id_' + object_id ;
            return id ;
        } ;
        // end chatEditTextAreaId filter
    }])

    .filter('chatEditImgId', [function () {
        // return part of cert_user_id before @
        return function (message) {
            // find receiver
            var hash_key = message['$$hashKey'] ;
            var object_id = hash_key.split(':')[1] ;
            var id = 'edit_chat_msg_img_id_' + object_id ;
            return id ;
        } ;
        // end chatEditImgId filter
    }])

    .filter('chatEditFormDisabled', [function () {
        // return part of cert_user_id before @
        return function (message) {
            // find receiver
            var hash_key = message['$$hashKey'] ;
            var object_id = hash_key.split(':')[1] ;
            var form_name = 'edit_chat_msg_form_' + object_id + '.$invalid';
            return form_name ;
        } ;
        // end chatEditFormName filter
    }])

    .filter('privacyTitle', [function () {
        // title for user info privacy selection. mouse over help
        // Search - search word is stored on server together with a random public key.
        //          server will match search words and return matches to clients
        // Public - info send to other contact after search match. Info is show in contact suggestions (public profile)
        // Unverified - info send to other unverified contact after adding contact to contact list (show more contact info)
        // Verified - send to verified contact after verification through a secure canal (show more contact info)
        // Hidden - private, hidden information. Never send to server or other users.
        var privacy_titles = {
            Search: "Search values are stored in clear text in a database and are used when searching for contacts. Shared with other ZeroNet users. SQL like wildcards are supported (% and _)",
            Public: "Info is sent encrypted to other contact after search match. Public Info is shown in contact search and contact suggestions. Your public profile",
            Unverified: "Info is sent encrypted to other unverified contact after adding contact to contact list. Additional info about you to other contact",
            Verified: "Info is sent encrypted to verified contact after contact verification through a secure canal. Your private profile",
            Hidden: "Private, hidden information. Not stored in ZeroNet and not send to other users. But is used when searching for new contacts"
        };
        return function (privacy) {
            return privacy_titles[privacy] || 'Start typing. Select privacy level';
        } ;
        // end privacyTitle filter
    }])

    .filter('showContactAction', ['MoneyNetworkService', function (moneyNetworkService) {
        // show/hide contact action buttons in network and chat pages
        var pgm = 'showContactAction filter: ';
        var allowed_type_actions, allowed_types, allowed_actions, i, array, index ;
        allowed_type_actions = [
            "new=>ignore", "guest=>ignore", "ignore=>unplonk", "new=>add", "guest=>add",
            "ignore=>add", "unverified=>remove", "unverified=>verify",
            "new=>chat", "guest=>chat", "unverified=>chat", "verified=>chat"
        ] ;
        allowed_types = [] ;
        allowed_actions = [] ;
        for (i=0 ; i<allowed_type_actions.length ; i++) {
            array = allowed_type_actions[i].split('=>');
            if (allowed_types.indexOf(array[0]) == -1) allowed_types.push(array[0]) ;
            if (allowed_actions.indexOf(array[1]) == -1) allowed_actions.push(array[1]) ;
        }
        var setup = moneyNetworkService.get_user_setup() ;
        var debug = (setup && setup.debug && setup.debug.enabled && setup.debug.show_contact_action_filter);
        return function (contact, action) {
            if (!contact || (allowed_types.indexOf(contact.type) == -1) || (allowed_actions.indexOf(action) == -1)) {
                if (debug) console.log(pgm + 'invalid call. contact = ' + JSON.stringify(contact) + ', action = ' + JSON.stringify(action)) ;
                return false ;
            }
            return (allowed_type_actions.indexOf(contact.type + '=>' + action) != -1) ;
        } ;
        // end privacyTitle filter
    }])

;
// angularJS app end
