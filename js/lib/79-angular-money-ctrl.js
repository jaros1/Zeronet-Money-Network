angular.module('MoneyNetwork')

    .controller('MoneyCtrl', ['$window', '$http', '$timeout', '$scope', 'safeApply', 'MoneyNetworkService',
        function ($window, $http, $timeout, $scope, safeApply, moneyNetworkService)
    {
        var self = this;
        var controller = 'MoneyCtrl';
        console.log(controller + ' loaded');

        self.is_logged_in = function() {
            if (!ZeroFrame.site_info) return false ;
            if (!ZeroFrame.site_info.cert_user_id) return false ;
            if (MoneyNetworkHelper.getUserId()) return true ;
            else return false ;
        };

        function calc_avg_rating() {
            var pgm = controller + '.calc_avg_rating: ' ;
            var i, wallet, sum_ratings, details, now, one_month, last_online, months, ratings, j ;

            // check last online filter. count only ratings and reviews newer than "last online"
            last_online = 0 ; // = 1/1-1970
            now = Math.floor((new Date().getTime())/1000) ;
            one_month = 60*60*24*364.25 / 12 ;
            for (i=0 ; i<self.filters.length ; i++) {
                if (self.filters[i].name != 'Last online') continue ;
                if (['', 'All'].indexOf(self.filters[i].value) != -1) ;
                else if (self.filters[i].value == 'Within last month') {
                    last_online = now - one_month ;
                }
                else {
                    months = parseInt(self.filters[i].value.split(' ')[2]) ;
                    last_online = now - months * one_month ;
                }
                break ;
            } // for i


            // todo: should also update "details[i].no_reviews"

            // add summary for ratings and reviews
            for (i=0 ; i<self.wallets.length ; i++) {
                wallet = self.wallets[i] ;
                if (!wallet.ratings) wallet.ratings = { details: [], no_ratings: 0, no_reviews: 0, avg_rating: 'n/a' } ;
                else {
                    wallet.ratings.no_ratings = 0 ;
                    wallet.ratings.no_reviews = 0 ;
                    sum_ratings = 0 ;
                    details = wallet.ratings.details || [] ;
                    for (i=0 ; i<details.length ; i++) {
                        ratings = details[i].ratings ;
                        for (j=0 ; j<ratings.length ; j++) {
                            if (ratings[j].last_online >= last_online) {
                                wallet.ratings.no_ratings++ ;
                                sum_ratings += ratings[j].rate ;
                                if (ratings[j].review) wallet.ratings.no_reviews++ ;
                            }
                        }
                    }
                    if (wallet.ratings.no_ratings) wallet.ratings.avg_rating = sum_ratings / wallet.ratings.no_ratings ;
                    else wallet.ratings.avg_rating = 'n/a' ;
                }
                wallet.ratings.show_hide = 'show' ;
            }
            // console.log(pgm + 'self.wallets = ' + CircularJSON.stringify(self.wallets)) ;
        }

        self.wallets = [] ;
        (function load_wallets() {
            var pgm = controller + '.load_wallets: ' ;
            var address_index, step_1_search_wallet_sites, step_2_load_user_wallet_json, step_3_load_users_wallets_json,
                step_4_done, rating_index_by_address, reviews_index_by_address ;

            address_index = {} ; // from wallet_address to row in self.wallets
            // rating_index_by_address = {} ; // from wallet_address to ratings object
            // reviews_index_by_address = {} ; // from wallet_address to ratings object

            // callback chain:
            // - 1) check wallet.json from added wallet data hubs
            // - 2) merge info from user's wallets.json file (shared wallet rating and reviews)
            // - 3) done. update angularJS UI

            step_4_done = function() {
                safeApply($scope) ;
            } ; // step_4_done

            // load shared wallet info from MN users (ratings and reviews)
            step_3_load_users_wallets_json = function() {
                var pgm = controller + '.load_wallets.step_3_load_users_wallets_json: ';

                var mn_query_22, debug_seq ;

                // find wallet info. check latest updated and shared wallet.json files first (wallet_modified = last wallet.json sign and publish)
                mn_query_22 =
                    "select " +
                    "  wallets_json.directory as wallets_directory, " +
                    "  wallets_modified.value as wallets_modified, " +
                    "  content_modified.value as content_modified, " +
                    "  content_cert_user_id.value as wallets_cert_user_id, " +
                    "  wallets.address, wallets.wallet_address, wallets.wallet_domain,  wallets.wallet_title, wallets.wallet_description, " +
                    "  wallets.api_url, wallets.wallet_sha256, wallets.wallet_modified, wallets.wallet_directory, " +
                    "  share.user_seq, share.rate, share.review, users.avatar, " +
                    "  (select cast(timestamp/1000 as int) from json as status_json, status " +
                    "   where status_json.directory = wallets_json.directory and status_json.file_name = 'status.json' " +
                    "   and status.json_id = status_json.json_id and status.user_seq = share.user_seq) as last_online, " +
                    "  (select group_concat(tag || ',' || value,',') from search " +
                    "   where search.json_id = data.json_id and search.user_seq = share.user_seq) as tags1, " +
                    "  (select group_concat(tag || '#' || value,'#') from search " +
                    "   where search.json_id = data.json_id and search.user_seq = share.user_seq) as tags2, " +
                    "  (select cast(status.timestamp/1000 as int) from json as status_json, status " +
                    "   where status_json.directory = wallets_json.directory and status_json.file_name = 'status.json' " +
                    "   and status.json_id = status_json.json_id and status.user_seq = share.user_seq) as last_online " +
                    "from wallets, json as wallets_json, json as content_json, keyvalue as content_modified, " +
                    "     keyvalue as wallets_modified, share, keyvalue as content_cert_user_id, json as data, users " +
                    "where wallets.wallet_modified is not null and wallets.json_id = wallets_json.json_id " +
                    "and content_json.directory = wallets_json.directory and content_json.file_name = 'content.json' " +
                    "and content_modified.json_id = content_json.json_id and content_modified.key = 'modified' " +
                    "and wallets_modified.json_id = wallets_json.json_id and wallets_modified.key = 'wallets_modified' " +
                    "and share.address = wallets.address and share.json_id = wallets.json_id " +
                    "and content_cert_user_id.json_id = content_json.json_id and content_cert_user_id.key = 'cert_user_id' " +
                    "and data.directory = wallets_json.directory and data.file_name = 'data.json' " +
                    "and users.json_id = data.json_id and users.user_seq = share.user_seq " +
                    "order by wallets.wallet_modified desc" ;

                console.log(pgm + 'mn_query_22 = ' + mn_query_22) ;
                debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, 'mn query 22', 'dbQuery', MoneyNetworkHelper.show_debug('z_db_query')) ;
                ZeroFrame.cmd("dbQuery", [mn_query_22], function (res) {
                    var pgm = controller + '.load_wallets.step_3_load_users_wallets_json dbQuery callback 1: ';
                    var add_wallet, check_wallet, save_rate_and_review ;
                    MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, (!res || res.error) ? 'Failed. error = ' + JSON.stringify(res) : 'OK');
                    if (res.error) {
                        console.log(pgm + "error. wallets lookup failed: " + res.error);
                        console.log(pgm + 'mn_query_22 = ' + mn_query_22);
                        return step_4_done();
                    }
                    console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                    //res = [
                    //    {
                    //        "wallet_description": "Money Network - Wallet 2 - BitCoins www.blocktrail.com - runner jro",
                    //        "wallets_directory": "1PgyTnnACGd1XRdpfiDihgKwYRRnzgz2zh/data/users/18DbeZgtVCcLghmtzvg4Uv8uRQAwR8wnDQ",
                    //        "wallet_title": "MoneyNetworkW2",
                    //        "api_url": "https://www.blocktrail.com/api/docs",
                    //        "wallet_directory": "1HXzvtSLuvxZfh6LgdaqTk4FSVf7x8w7NJ/data/users/18DbeZgtVCcLghmtzvg4Uv8uRQAwR8wnDQ",
                    //        "wallet_address": "1LqUnXPEgcS15UGwEgkbuTbKYZqAUwQ7L1",
                    //        "review": "Very nice test bitcoin wallet with fine MN-wallet integration. Have tested many send/receive money transaction OK from MN chat. Not fast but is working. Also tested backup (export & import) from MN.",
                    //        "wallet_domain": null,
                    //        "wallet_sha256": "23823ecbc270ac395f20b068efa992d758988b85d570294d81434a463df3210c",
                    //        "wallets_cert_user_id": "jro@zeroid.bit",
                    //        "rate": 4,
                    //        "address": "1LqUnXPEgcS15UGwEgkbuTbKYZqAUwQ7L1",
                    //        "wallet_modified": 1520440207,
                    //        "user_seq": 1,
                    //        "wallets_modified": 1520505250
                    //    }, {
                    //        "wallet_description": "Money Network - Wallet 2 - BitCoins www.blocktrail.com - runner jro",
                    //        "wallets_directory": "182Uot1yJ6mZEwQYE5LX1P5f6VPyJ9gUGe/data/users/16nDbDocFiEsuBn91SknhYFbA33DVdxMQ9",
                    //        "wallet_title": "MoneyNetworkW2",
                    //        "api_url": "https://www.blocktrail.com/api/docs",
                    //        "wallet_directory": "1HXzvtSLuvxZfh6LgdaqTk4FSVf7x8w7NJ/data/users/16nDbDocFiEsuBn91SknhYFbA33DVdxMQ9",
                    //        "wallet_address": "1LqUnXPEgcS15UGwEgkbuTbKYZqAUwQ7L1",
                    //        "review": null,
                    //        "wallet_domain": null,
                    //        "wallet_sha256": "23823ecbc270ac395f20b068efa992d758988b85d570294d81434a463df3210c",
                    //        "wallets_cert_user_id": "16nDbDocFiEsu@moneynetwork.bit",
                    //        "rate": 4,
                    //        "address": "1LqUnXPEgcS15UGwEgkbuTbKYZqAUwQ7L1",
                    //        "wallet_modified": 1520324127,
                    //        "user_seq": 1,
                    //        "wallets_modified": 1520505432
                    //    }];


                    // todo: 1) calc avg rating for each wallet_address
                    // todo: 2) sum number of reviews

                    add_wallet = function (row, wallet) {
                        address_index[wallet.wallet_address] = self.wallets.length ;
                        row.wallet = wallet ;
                        row.wallet_address = wallet.wallet_address ;
                        if (wallet.wallet_domain) row.wallet_domain = wallet.wallet_domain ;
                        row.wallet_url = '/' + (row.wallet_domain || row.wallet_address) ;
                        if (wallet.wallet_description) row.wallet_description = wallet.wallet_description ;
                        self.wallets.push(row) ;
                    } ; // add_wallet

                    save_rate_and_review = function (row) {
                        var i, wallet, found_i, details, row2 ;
                        i = address_index[row.address] ;
                        wallet = self.wallets[i] ;
                        if (!wallet.ratings) wallet.ratings = { details: [] } ;
                        details = wallet.ratings.details ;
                        found_i = -1 ;
                        for (i=0 ; i<details.length ; i++) {
                            if (row.rate == details[i].rate) {
                                found_i = i ;
                                break ;
                            }
                        } // for i
                        if (found_i == -1) {
                            found_i = details.length ;
                            details.push({ rate: row.rate, ratings: [], no_reviews: 0, show_hide: 'show' }) ;
                        }
                        // row2:
                        // from MN user data hub: wallets_directory, wallets_modified, rate and review (MN user review)
                        // from wallet data hub: wallet_directory and wallet_modified (when was wallet info updated and by whom)
                        row2 = {
                            wallets_directory: row.wallets_directory,
                            wallets_modified: row.wallets_modified,
                            wallets_cert_user_id: row.wallets_cert_user_id,
                            user_seq: row.user_seq,
                            last_online: row.last_online,
                            avatar: row.avatar,
                            tags1: row.tags1,
                            tags2: row.tags2,
                            rate: row.rate
                        } ;
                        if (row.review) row2.review = row.review ;
                        row2.wallet_directory = row.wallet_directory ;
                        row2.wallet_modified = row.wallet_modified ;
                        details[found_i].ratings.push(row2) ;
                    } ; // save_rate_and_review

                    check_wallet = function () {
                        var pgm = controller + '.load_wallets.step_3_load_users_wallets_json check_wallet 2: ';
                        var row, inner_path, get_wallet_info, i, no_ratings, sum_ratings, address, rating, wallet, details, rate ;
                        row = res.shift() ;
                        if (!row) {
                            // done. add summary for ratings and reviews
                            calc_avg_rating() ;

                            return step_4_done() ;
                        }
                        if (!row.wallets_modified) row.wallets_modified = row.content_modified ; // normally always a wallets_modified timestamp in wallets.json file
                        if (!row.last_online) row.last_online = row.content_modified ; // normally always a last_online = timestamp in status.json file.

                        if (address_index.hasOwnProperty(row.wallet_address)) {
                            // already checked
                            save_rate_and_review(row) ;
                            return check_wallet() ;
                        }
                        // two paths. either a wallet.json with full info (a) or a wallet.json with wallet_sha256 only (b)

                        // path b: looks like a wallet.json with wallet_sha256 only. also used as fallback in path a
                        get_wallet_info = function (row) {
                            MoneyNetworkAPILib.get_wallet_info(row.wallet_sha256, function (wallet_info) {
                                var pgm = controller + '.load_wallets.step_3_load_users_wallets_json get_wallet_info callback 3b: ';
                                if (!wallet_info || !wallet_info[row.wallet_sha256]) {
                                    console.log(pgm + 'ignore ' + inner_path + '. could not find any wallet info for wallet_sha256 ' + row.wallet_sha256) ;
                                    return check_wallet() ;
                                }
                                // OK. found valid wallet with full wallet info
                                add_wallet(row, wallet_info[row.wallet_sha256]) ;
                                save_rate_and_review(row) ;
                                check_wallet();
                            }) ;
                        } ; // get_wallet_info

                        if (row.wallet_address && row.wallet_title && row.wallet_description) {
                            // path a: looks like a wallet.json file with full info
                            // read wallets.json
                            inner_path = 'merged-' + MoneyNetworkAPILib.get_merged_type() + '/' + row.wallets_directory + '/wallets.json' ;
                            MoneyNetworkAPILib.z_file_get(pgm, {inner_path: inner_path}, function (wallets_str, extra) {
                                var pgm = controller + '.load_wallets.step_3_load_users_wallets_json z_file_get callback 3a: ';
                                var wallets, error, wallet, wallet_sha256 ;
                                if (!wallets_str) {
                                    console.log(pgm + 'error: ' + inner_path + ' fileGet failed') ;
                                    return get_wallet_info() ;
                                }
                                // check wallets
                                try {
                                    wallets = JSON.parse(wallets_str) ;
                                }
                                catch (e) {
                                    console.log(pgm + 'error: ' + inner_path + ' is invalid. error = ' + e.message) ;
                                    return get_wallet_info() ;
                                }
                                // json validate wallets.json file
                                error = MoneyNetworkAPILib.validate_json(pgm, wallets, null, 'api') ;
                                if (error) {
                                    console.log(pgm + 'error: ' + inner_path + ' is invalid. error = ' + error) ;
                                    return get_wallet_info() ;
                                }
                                wallet = wallets.wallets[row.wallet_address] ;
                                wallet_sha256 = MoneyNetworkAPILib.calc_wallet_sha256(wallet) ;
                                if (!wallet_sha256 || (wallet.wallet_sha256 != wallet_sha256)) {
                                    console.log(pgm + 'ignore ' + inner_path + '. ' + wallet_sha256 + ' != ' + wallet.wallet_sha256) ;
                                    return get_wallet_info() ;
                                }
                                // OK. full wallet info and wallet is valid
                                add_wallet(row, wallet) ;
                                save_rate_and_review(row) ;
                                check_wallet();
                            }) ;

                        }
                        else {
                            // path b: looks like a wallet.json with wallet_sha256 only
                            get_wallet_info() ;
                        }

                    } ; // check_wallet 2
                    // start check_wallet loop
                    check_wallet() ;

                }) ; // dbQuery callback 1

            } ; // step_3_load_users_wallets_json

            // todo: step 2.5. load not shared rating and review from localStorage
            //       including review without rating. not in wallets.json file.

            // load shared wallet info saved by this user.
            step_2_load_user_wallet_json = function() {
                var pgm = controller + '.load_wallets.step_2_load_user_wallet_json: ';
                if (!self.is_logged_in()) return step_3_load_users_wallets_json() ;

                moneyNetworkService.get_my_user_hub(function(my_user_data_hub, other_user_hub, other_user_hub_title) {
                    var pgm = controller + '.load_wallets.step_2_load_user_wallet_json get_my_user_hub callback 1: ';
                    var user_path, inner_path, wallet_addresses ;
                    user_path = "merged-" + MoneyNetworkAPILib.get_merged_type() + "/" + my_user_data_hub + "/data/users/" + ZeroFrame.site_info.auth_address ;
                    inner_path = user_path + "/wallets.json";
                    MoneyNetworkAPILib.z_file_get(pgm, {inner_path: inner_path, required: false}, function (wallets_str, extra) {
                        var pgm = controller + '.load_wallets.step_2_load_user_wallet_json z_file_get callback 2: ';
                        var wallets, error, i, wallet, user_wallet_addresses, wallet_address, row, j, my_shared_wallets ;
                        if (!wallets_str) return step_3_load_users_wallets_json() ; // no shared wallet information
                        try { wallets = JSON.parse(wallets_str); }
                        catch (e) {
                            console.log(pgm + 'error. ignore invalid wallets.json. error = ' + e.message) ;
                            return step_3_load_users_wallets_json() ;
                        }
                        error = MoneyNetworkAPILib.validate_json(pgm, wallets, null, 'api') ;
                        if (error) {
                            console.log(pgm + 'error. ignore invalid wallets.json. error = ' + error) ;
                            return step_3_load_users_wallets_json() ;
                        }

                        // find shared wallets for local user.
                        my_shared_wallets = {} ;
                        for (i=0 ; i<wallets.share.length ; i++) {
                            if (z_cache.user_seq == wallets.share[i].user_seq) my_shared_wallets[wallets.share[i].address] = 0 ;
                        }

                        // check wallet addresses in wallets.wallets object hash. must be unique
                        for (wallet_address in wallets.wallets) {
                            if (!my_shared_wallets.hasOwnProperty(wallet_address)) continue ; // shared by other local user account
                            wallet = wallets.wallets[wallet_address] ;
                            error = MoneyNetworkAPILib.validate_json(pgm, wallet, null, 'api') ;
                            if (error) {
                                console.log(pgm + 'ignoring invalid wallet for ' + wallet_address + '. error = ' + error) ;
                                delete my_shared_wallets[wallet_address];
                                continue ;
                            }
                            // extra validations:
                            if (wallet.wallet_address && (wallet.wallet_address != wallet_address)) {
                                console.log(pgm + 'ignoring invalid wallet. address key = ' + wallet_address + '. wallet_address = ' + wallet.wallet_address) ;
                                delete my_shared_wallets[wallet_address];
                                continue ;
                            }
                            if (!wallet.wallet_modified || !wallet.wallet_directory) {
                                console.log(pgm + 'ignoring invalid wallet. wallet_modified and/or wallet_directory is missing for ' + wallet_address) ;
                                delete my_shared_wallets[wallet_address];
                                continue ;
                            }
                            my_shared_wallets[wallet_address]++ ;
                            if (my_shared_wallets[wallet_address] > 1) {
                                console.log(pgm + 'ignoring invalid wallet for ' + wallet_address + '. error. doublet wallet address') ;
                                delete my_shared_wallets[wallet_address];
                            }
                        } // for wallet_address
                        if (!Object.keys(wallets.wallets).length) return step_3_load_users_wallets_json() ;

                        // add info from wallets.json file (only this user_seq / this local account)
                        for (wallet_address in my_shared_wallets) {
                            if (address_index.hasOwnProperty(wallet_address)) {
                                i = address_index[wallet_address] ;
                                row = self.wallets[i] ;
                            }
                            else {
                                // wallet info is only in user wallets.json file. maybe info shared from other MN users or disconnected wallet
                                // add to self.wallets with share_wallet = true
                                wallet = wallets.wallets[wallet_address] ;
                                row = {
                                    wallet_address: wallet.wallet_address,
                                    wallet_domain: wallet.wallet_domain,
                                    wallet_url: '/' + (wallet.wallet_domain || wallet.wallet_address),
                                    wallet_title: wallet.wallet_title,
                                    wallet_description: wallet.wallet_description,
                                    wallet: wallet
                                } ;
                                address_index[wallet_address] = self.wallets.length ;
                                self.wallets.push(row);
                            }
                            row.share_wallet = true ;
                            // add info from share array (rating and review)
                            for (i=0 ; i<wallets.share.length ; i++) {
                                if ((wallets.share[i].user_seq == z_cache.user_seq) && (wallets.share[i].address == wallet_address)) {
                                    if (wallets.share[i].rate) {
                                        row.rate_wallet = wallets.share[i].rate ;
                                        if (wallets.share[i].review) row.wallet_review = wallets.share[i].review ;
                                    }
                                }
                            } // for i
                        } // for wallet_address

                        step_3_load_users_wallets_json() ;

                    }) ; // z_file_get callback 2

                }) ; // get_my_user_hub callback 1

            } ; // step_2_load_user_wallet_json

            step_1_search_wallet_sites = function() {
                var pgm = controller + '.load_wallets.step_1_search_wallet_sites: ' ;
                var mn_query_21, debug_seq ;

                // find wallet info. latest updated content.json should contain latest info about wallet
                mn_query_21 =
                    "select " +
                    "  wallet.directory as wallet_directory, modified.value as wallet_modified," +
                    "  wallet_address.value as wallet_address, wallet_title.value as wallet_title, wallet_description.value as wallet_description, wallet_sha256.value as wallet_sha256 " +
                    "from json as wallet, json as content, keyvalue as modified, keyvalue as wallet_address, keyvalue as wallet_title, keyvalue as wallet_description, keyvalue as wallet_sha256 " +
                    "where wallet.file_name = 'wallet.json' " +
                    "and content.directory = wallet.directory and content.file_name  = 'content.json' " +
                    "and modified.json_id = content.json_id and modified.key = 'modified' " +
                    "and wallet_address.json_id = wallet.json_id and wallet_address.key = 'wallet_address' " +
                    "and wallet_title.json_id = wallet.json_id and wallet_title.key = 'wallet_title' " +
                    "and wallet_description.json_id = wallet.json_id and wallet_description.key = 'wallet_description' " +
                    "and wallet_sha256.json_id = wallet.json_id and wallet_sha256.key = 'wallet_sha256' " +
                    "order by modified.value desc" ;

                debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, 'mn query 21', 'dbQuery', MoneyNetworkHelper.show_debug('z_db_query')) ;
                ZeroFrame.cmd("dbQuery", [mn_query_21], function (res) {
                    var pgm = controller + '.load_wallets.step_1_search_wallet_sites dbQuery callback 1: ';
                    var add_wallet, check_wallet, inner_path ;
                    MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, (!res || res.error) ? 'Failed. error = ' + JSON.stringify(res) : 'OK');
                    if (res.error) {
                        console.log(pgm + "wallets lookup failed: " + res.error);
                        console.log(pgm + 'mn_query_21 = ' + mn_query_21);
                        return ;
                    }
                    // console.log(pgm + 'res = ' + JSON.stringify(res)) ;

                    add_wallet = function (row, wallet) {
                        address_index[wallet.wallet_address] = self.wallets.length ;
                        row.wallet = wallet ;
                        row.wallet_address = wallet.wallet_address ;
                        if (wallet.wallet_domain) row.wallet_domain = wallet.wallet_domain ;
                        row.wallet_url = '/' + (row.wallet_domain || row.wallet_address) ;
                        if (wallet.wallet_description) row.wallet_description = wallet.wallet_description ;
                        self.wallets.push(row) ;
                    } ; // add_wallet

                    check_wallet = function () {
                        var pgm = controller + '.load_wallets.step_1_search_wallet_sites check_wallet 2: ';
                        var row, get_wallet_info ;
                        row = res.shift() ;
                        if (!row) {
                            // done
                            console.log(pgm + 'self.wallets = ' + JSON.stringify(self.wallets)) ;
                            return step_2_load_user_wallet_json() ;
                        }
                        if (address_index.hasOwnProperty(row.wallet_address)) return check_wallet() ; // already checked
                        // two paths. either a wallet.json with full info (a) or a wallet.json with wallet_sha256 only (b)

                        // path b: looks like a wallet.json with wallet_sha256 only. also used as fallback in path a
                        get_wallet_info = function (row) {
                            MoneyNetworkAPILib.get_wallet_info(row.wallet_sha256, function (wallet_info) {
                                var pgm = controller + '.load_wallets.step_1_search_wallet_sites get_wallet_info callback 3b: ';
                                if (!wallet_info || !wallet_info[row.wallet_sha256]) {
                                    console.log(pgm + 'ignore ' + inner_path + '. could not find any wallet info for wallet_sha256 ' + row.wallet_sha256) ;
                                    return check_wallet() ;
                                }
                                // OK. found valid wallet with full wallet info
                                add_wallet(row, wallet_info[row.wallet_sha256]) ;
                                check_wallet();
                            }) ;
                        } ; // get_wallet_info

                        if (row.wallet_address && row.wallet_title && row.wallet_description) {
                            // path a: looks like a wallet.json file with full info
                            // read wallet.json
                            inner_path = 'merged-' + MoneyNetworkAPILib.get_merged_type() + '/' + row.wallet_directory + '/wallet.json' ;
                            MoneyNetworkAPILib.z_file_get(pgm, {inner_path: inner_path}, function (wallet_str, extra) {
                                var pgm = controller + '.load_wallets.step_1_search_wallet_sites z_file_get callback 3a: ';
                                var wallet, wallet_sha256 ;
                                if (!wallet_str) {
                                    console.log(pgm + 'error: ' + inner_path + ' fileGet failed') ;
                                    return get_wallet_info() ;
                                }
                                // check wallet
                                try {
                                    wallet = JSON.parse(wallet_str) ;
                                }
                                catch (e) {
                                    console.log(pgm + 'error: ' + inner_path + ' is invalid. error = ' + e.message) ;
                                    return get_wallet_info() ;
                                }
                                wallet_sha256 = MoneyNetworkAPILib.calc_wallet_sha256(wallet) ;
                                if (!wallet_sha256 || (wallet.wallet_sha256 != wallet_sha256)) {
                                    console.log(pgm + 'ignore ' + inner_path + '. ' + wallet_sha256 + ' != ' + wallet.wallet_sha256) ;
                                    // ignore merged-MoneyNetwork/1HXzvtSLuvxZfh6LgdaqTk4FSVf7x8w7NJ/data/users/18DbeZgtVCcLghmtzvg4Uv8uRQAwR8wnDQ/wallet.json. null != undefined
                                    return get_wallet_info() ;
                                }
                                // OK. full wallet info and wallet is valid
                                add_wallet(row, wallet) ;
                                check_wallet();
                            }) ;
                            return ;

                        }
                        else {
                            // path b: looks like a wallet.json file with wallet_sha256 only
                            MoneyNetworkAPILib.get_wallet_info(row.wallet_sha256, function (wallet_info) {
                                var pgm = controller + '.load_wallets.step_1_search_wallet_sites get_wallet_info callback 3b: ';
                                if (!wallet_info || !wallet_info[row.wallet_sha256]) {
                                    console.log(pgm + 'ignore ' + inner_path + '. could not find any wallet info for wallet_sha256 ' + row.wallet_sha256 + ', row = ' + JSON.stringify(row)) ;
                                    return check_wallet() ;
                                }
                                // OK. found valid wallet with full wallet info
                                add_wallet(row, wallet_info[row.wallet_sha256]) ;
                                check_wallet();
                            }) ;
                            return ;
                        }

                    } ; // check_wallet 2
                    // start check_wallet loop
                    check_wallet() ;

                }) ; // dbQuery callback 1

            } ; // step_1_search_wallet_sites

            step_1_search_wallet_sites() ;

        })() ; // load_wallets

        self.open_wallet_url = function(wallet) {
            var pgm = controller + '.open_wallet_url: ' ;
            moneyNetworkService.open_window(pgm, wallet.wallet_url);
        } ;

        // rate and review wallets helpers:

        var z_cache = moneyNetworkService.get_z_cache() ;

        // save wallets.json file. only rows with share_wallet = true. share checkbox checked
        function update_wallets_json () {
            var pgm = controller + '.update_wallets_json: ' ;

            // read old wallets.json. must keep shared info from other local users
            // wallets json is OK. write and publish file
            moneyNetworkService.get_my_user_hub(function(my_user_data_hub, other_user_hub, other_user_hub_title) {
                var pgm = controller + '.update_wallets_json get_my_user_hub callback 1: ';
                var user_path, inner_path1;
                user_path = "merged-" + MoneyNetworkAPILib.get_merged_type() + "/" + my_user_data_hub + "/data/users/" + ZeroFrame.site_info.auth_address;
                inner_path1 = user_path + "/wallets.json";

                // read old wallets.json file.
                MoneyNetworkAPILib.z_file_get(pgm, {inner_path: inner_path1}, function (old_wallets_str) {
                    var pgm = controller + '.update_wallets_json z_file_get callback 2: ';
                    var old_wallets, error, new_wallets, keep_addresses, i, row1, wallet_address, wallet, j, rate, row2,
                        identical, old_addresses, new_addresses, old_wallet, new_wallet, sort_fnc, now, json_raw,
                        wallet_addresses, compress_wallet ;
                    if (old_wallets_str) {
                        try {
                            old_wallets = JSON.parse(old_wallets_str);
                        }
                        catch (e) {
                            old_wallets = {msgtype: 'wallets', wallets: {}, share: []};
                        }
                    }
                    else {
                        old_wallets = {msgtype: 'wallets', wallets: {}, share: []};
                    }
                    // is old wallet valid?
                    error = MoneyNetworkAPILib.validate_json(pgm, old_wallets, null, 'api') ;
                    if (error) {
                        console.log(pgm + 'error. ignoring invalid old wallets.json file ' + inner_path1 + '. error = ' + error) ;
                        old_wallets = {msgtype: 'wallets', wallets: {}, share: []};
                    }
                    if (old_wallets.msgtype != 'wallets') {
                        console.log(pgm + 'error. ignoring old wallets.json file ' + inner_path1 + '. expected msgtype = wallets') ;
                        old_wallets = {msgtype: 'wallets', wallets: {}, share: []};
                    }

                    // copy share info from other local accounts
                    new_wallets = {msgtype: 'wallets', wallets: {}, share: []};
                    keep_addresses = {} ;
                    for (i=0 ; i < old_wallets.share.length ; i++) {
                        if (old_wallets.share[i].user_seq != z_cache.user_seq) {
                            keep_addresses[old_wallets.share[i].address] = true ;
                            new_wallets.share.push(old_wallets.share[i]) ;
                        }
                    }

                    // todo: save not shared rating and review in ls
                    for (i=0 ; i<self.wallets.length ; i++) {
                        row1 = self.wallets[i] ;
                        wallet_address = row1.wallet_address ;
                        // save wallet info in wallets hash
                        if (row1.share_wallet || keep_addresses[wallet_address]) {
                            wallet = JSON.parse(JSON.stringify(row1.wallet)) ;
                            delete wallet['$$hashKey'] ;
                            for (j=0 ; j<wallet.currencies.length ; j++) {
                                delete wallet.currencies[j]['$$hashKey'] ;
                            }
                            // add extra wallet info only in wallets.json file. MN users must be able to see modified timestamp for wallet.json file for shared information. last updated info is used
                            wallet.wallet_modified = row1.wallet_modified ;
                            wallet.wallet_directory = row1.wallet_directory ;
                            if (!wallet.wallet_modified || !wallet.wallet_directory) {
                                error = ['Cannot save wallets.json file', 'Required wallet_modified and/or wallet_directory information is missing for wallet', 'wallet_info = ' + JSON.stringify(row1)] ;
                                console.log(pgm + 'error: ' + error.join('. ')) ;
                                moneyNetworkService.z_wrapper_notification(['error', error.join('<br>')]) ;
                                return ;
                            }
                            new_wallets.wallets[wallet_address] = wallet ;
                        }
                        if (!row1.share_wallet) continue ;
                        // add share info to share array
                        rate = row1.rate_wallet ;
                        if (['1','2','3','4','5'].indexOf(rate) != -1) rate = parseInt(rate) ;
                        if (rate) {
                            row2 = { user_seq: z_cache.user_seq, address: wallet_address, rate: rate } ;
                            if (row1.wallet_review) row2.review = row1.wallet_review ;
                            new_wallets.share.push(row2) ;
                        }
                    }
                    now = new Date().getTime() ;
                    now = Math.floor(now/1000) ;
                    new_wallets.wallets_modified = now ;

                    // validate wallets.json before write.
                    // two validations: top level is validated with "wallets". wallets object hash is validated with "wallet"
                    error = MoneyNetworkAPILib.validate_json(pgm, new_wallets, null, 'api') ;
                    if (error) {
                        console.log(pgm + 'error. cannot save invalid wallets.json file. error = ' + error) ;
                        console.log(pgm + 'wallets = ' + JSON.stringify(wallets)) ;
                        return ;
                    }
                    for (wallet_address in new_wallets.wallets) {
                        wallet = new_wallets.wallets[wallet_address] ;
                        error = MoneyNetworkAPILib.validate_json(pgm, wallet, null, 'api') ;
                        if (error) {
                            console.log(pgm + 'error. cannot save invalid wallets.json file. wallet_address = ' + wallet_address + '. error = ' + error) ;
                            return ;
                        }
                    }

                    // compress wallet information
                    // check wallets.json files from other users. compress wallet info if finding 5 or more wallets with identical full wallet info
                    wallet_addresses = Object.keys(new_wallets.wallets) ;
                    compress_wallet = function (cb) {
                        var pgm = controller + '.update_wallets_json compress 3a: ';
                        var wallet_address, my_directory, wallet_sha256, mn_query_23, debug_seq3 ;
                        wallet_address = wallet_addresses.shift() ;
                        if (!wallet_address) return cb() ; // finish compressing wallet information
                        wallet_sha256 = new_wallets.wallets[wallet_address].wallet_sha256 ;
                        my_directory = my_user_data_hub + '/data/users/' + ZeroFrame.site_info.auth_address ;

                        // find wallets with full wallet info on this user data hub (identical wallet_sha256)
                        mn_query_23 =
                            "select wallets_json.directory " +
                            "from wallets, json as wallets_json, keyvalue as wallets_modified " +
                            "where wallets.wallet_sha256 = '" + wallet_sha256 + "' " +
                            "and wallets_json.json_id = wallets.json_id " +
                            "and wallets_json.directory != '" + my_directory + "' " +
                            "and wallets_modified.json_id = wallets.json_id and wallets_modified.key = 'wallets_modified' " +
                            "/* and substr(wallets_json.directory,1,instr(wallets_json.directory,'/')-1) = '1PgyTnnACGd1XRdpfiDihgKwYRRnzgz2zh' */ " +
                            "and wallets.wallet_address is not null and wallets.wallet_title is not null and wallets.wallet_description is not null " +
                            "order by  wallets_modified.key  desc" ;

                        console.log(pgm + 'mn_query_23 = ' + mn_query_23) ;
                        debug_seq3 = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, 'mn query 23', 'dbQuery', MoneyNetworkHelper.show_debug('z_db_query')) ;
                        ZeroFrame.cmd("dbQuery", [mn_query_23], function (res) {
                            var pgm = controller + '.update_wallets_json dbQuery callback 4a: ';
                            var no_ok, read_and_check;
                            MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq3, (!res || res.error) ? 'Failed. error = ' + JSON.stringify(res) : 'OK');
                            if (res.error) {
                                console.log(pgm + "error. wallets compress failed: " + res.error);
                                console.log(pgm + 'mn_query_23 = ' + mn_query_23);
                                // skipping compress
                                return cb();
                            }
                            no_ok = 0 ;
                            read_and_check = function (index) {
                                var pgm = controller + '.update_wallets_json read_and_check 5a: ';
                                var row, inner_path5 ;
                                if (res.length + no_ok < 5) {
                                    // less than 5 files with full wallets information
                                    console.log(pgm + 'not compressing wallet info for ' + wallet_address + '. less that 5 wallets.json files with full wallet information');
                                    return compress_wallet(cb) ;
                                }
                                row = res.shift() ;
                                inner_path5 = 'merged-' + MoneyNetworkAPILib.get_merged_type() + '/' + row.directory + '/wallets.json' ;
                                z_file_get(pgm, {inner_path: inner_path5}, function (wallets_str) {
                                    var pgm = controller + '.update_wallets_json z_file_get callback 6a: ';
                                    var wallets, error, wallet ;
                                    if (!wallets_str) {
                                        console.log(pgm + 'error. ' + inner_path5 + ' was not found') ;
                                        return read_and_check() ;
                                    }
                                    try { wallets = JSON.parse(wallets_str) }
                                    catch (e) {
                                        console.log(pgm + 'error. ' + inner_path5 + ' is invalid. error = ' + e.message) ;
                                        return read_and_check() ;
                                    }
                                    error = MoneyNetworkAPILib.validate_json(pgm, wallets, null, 'api') ;
                                    if (error) {
                                        console.log(pgm + 'error. ' + inner_path5 + ' is invalid. error = ' + error) ;
                                        return read_and_check() ;
                                    }
                                    wallet = wallets.wallets[wallet_address] ;
                                    if (!wallet) {
                                        console.log(pgm + 'error. could not find wallet_address ' + wallet_address + ' in ' + inner_path5) ;
                                        return read_and_check() ;
                                    }
                                    error = MoneyNetworkAPILib.validate_json(pgm, wallet, null, 'api') ;
                                    if (error) {
                                        console.log(pgm + 'error. wallet ' + wallet_address + ' in ' + inner_path5 + ' is invalid. error = ' + error) ;
                                        return read_and_check() ;
                                    }
                                    if (!wallet.wallet_address || !wallet.wallet_title || !wallet.wallet_description || !wallet.currencies) {
                                        console.log(pgm + 'skipping wallet ' + wallet_address + ' in ' + inner_path5 + '. not full wallet info') ;
                                        return read_and_check() ;
                                    }
                                    // found wallet with full information
                                    no_ok++ ;
                                    if (no_ok < 5) return read_and_check() ;
                                    // OK. found 5 wallets.json files with full wallets information. compress wallets info
                                    console.log(pgm + 'compressing wallet info for ' + wallet_address + '. found 5 wallets.json files with full wallet information');
                                    wallet = new_wallets.wallets[wallet_address] ;
                                    console.log(pgm + 'compressing wallet information for wallet_address ' + wallet_address) ;
                                    console.log(pgm + 'old wallet = ' + JSON.stringify(wallet)) ;
                                    delete wallet.wallet_address ;
                                    delete wallet.wallet_domain ;
                                    delete wallet.wallet_title ;
                                    delete wallet.wallet_description ;
                                    delete wallet.currencies ;
                                    delete wallet.api_url ;
                                    delete wallet.json_schemas ;
                                    delete wallet.message_workflow ;
                                    console.log(pgm + 'new wallet = ' + JSON.stringify(wallet)) ;
                                    // compress next wallet
                                    compress_wallet(cb) ;

                                }); // z_file_get callback 6a

                            }; // read_and_check 5a
                            read_and_check(0) ;

                        }) ; // dbQuery callback 4a

                    }; // compress 3
                    compress_wallet(function() {
                        var pgm = controller + '.update_wallets_json compress callback 3b: ';

                        // compare old and new wallets
                        identical = true ;
                        old_addresses = Object.keys(old_wallets.wallets).sort() ;
                        new_addresses = Object.keys(new_wallets.wallets).sort() ;
                        if (JSON.stringify(old_addresses) != JSON.stringify(new_addresses)) identical = false ;
                        if (identical) {
                            for (wallet_address in old_wallets.wallets) {
                                old_wallet = old_wallets.wallets[wallet_address] ;
                                new_wallet = new_wallets.wallets[wallet_address] ;
                                if (JSON.stringify(old_wallet) != JSON.stringify(new_wallet)) {
                                    identical = false ;
                                    break ;
                                }
                            }
                        }
                        if (identical) {
                            sort_fnc = function (a,b) {
                                var a_str, b_str ;
                                a_str = JSON.stringify(a) ;
                                b_str = JSON.stringify(b) ;
                                if (a_str == b_str) return 0 ;
                                if (a_str < b_str) return -1 ;
                                else return 1 ;

                            };
                            old_wallets.share.sort(sort_fnc) ;
                            new_wallets.share.sort(sort_fnc) ;
                            if (JSON.stringify(old_wallets.share) != JSON.stringify(new_wallets.share)) identical = false ;
                        }
                        if (identical) {
                            console.log(pgm + 'no change to wallets.json file') ;
                            return ;
                        }

                        json_raw = unescape(encodeURIComponent(JSON.stringify(new_wallets, null, "\t")));
                        MoneyNetworkAPILib.z_file_write(pgm, inner_path1, btoa(json_raw), {}, function (res) {
                            var pgm = controller + '. update_wallets_json z_file_write callback 4b: ';
                            var inner_path2 ;
                            if (res != 'ok') {
                                console.log(pgm + 'error: ' + inner_path1 + ' fileWrite failed. error = ' + JSON.stringify(res)) ;
                                return ;
                            }

                            // heck for pending MN publish.
                            if (moneyNetworkService.is_publish_running()) {
                                console.log(pgm + 'wallets.json file was updated. Other publish operation is already running') ;
                                return ;
                            }

                            // publish
                            inner_path2 = user_path + '/content.json' ;
                            moneyNetworkService.zeronet_site_publish({inner_path: inner_path2}, function (res) {
                                var pgm = controller + '. update_wallets_json zeronet_site_publish callback 5b: ';
                                if (res != 'ok') console.log(pgm + 'error. wallets.json publish failed. error = ' + JSON.stringify(res)) ;
                            }) ; // zeronet_site_publish callback 5b

                        }) ; // z_file_write callback 4b

                    }) ; // compress callback 3b


                }); // z_file_get callback 2

            }) ; // get_my_user_seq callback 1

        } // update_wallets_json

        // share/unshare wallet with other MN users
        self.share_wallet_changed = function (wallet) {
            var pgm = controller + '.share_wallet_changed: ' ;
            console.log(pgm + 'wallet.share_wallet = ' + wallet.share_wallet);
            update_wallets_json() ;
        } ;

        // review text helper
        self.handleTextAreaHeight = function (e) {
            var element = e.target;
            element.style.overflow = 'hidden';
            element.style.height = 0;
            element.style.height = element.scrollHeight + 'px';
        };

        self.rating_changed = function (wallet) {
            var pgm = controller + '.rating_changed: ' ;
            console.log(pgm + 'rate_wallet = ' + wallet.rate_wallet) ;
            update_wallets_json() ;
        } ;

        // save updated review
        self.review_updated = function (wallet) {
            var pgm = controller + '.review_updated: ' ;
            console.log(pgm + 'wallet_review = ' + wallet.wallet_review) ;
            update_wallets_json() ;
        };

        // show/hide overview. number of rating and reviews for reach rate / number of hearts
        self.show_details1 = function (wallet) {
            var pgm = controller + '.show_details1: ' ;
            var details, i ;
            console.log(pgm + 'wallet = ' + CircularJSON.stringify(wallet)) ;
            wallet.ratings.show_hide = wallet.ratings.show_hide == 'show' ? 'hide' : 'show' ;
            details = wallet.ratings.details ;
            if (details && (wallet.ratings.show_hide == 'show')) {
                // collapse details level 2 (individual rating and reviews)
                for (i=0 ; i<details.length ; i++) details[i].show_hide = 'show' ;
            }
        }; // show_details1


        var ls_contacts = moneyNetworkService.get_contacts() ;

        // show/hide individual rating and reviews
        // todo: not logged in: can only show hub and auth_address for MN users
        // todo: logged in: missing user_seq in wallets.json to translate to a contact
        self.show_details2 = function (detail) {
            var pgm = controller + '.show_details2: ' ;
            var missing_contact_info, i, row, wallets_directory_a, hub, auth_address, user_seq, avatar_obj, avatar_a, avatar, user_info, search, tags1, tags2, pos1, pos2 ;
            console.log(pgm + 'detail = ' + JSON.stringify(detail)) ;

            // just hide
            if (detail.show_hide == 'hide') {
                detail.show_hide = 'show' ;
                return ;
            }

            // check/add contact info
            missing_contact_info = [] ;
            for (i=0 ; i<detail.ratings.length ; i++) if (!detail.ratings[i].contact) missing_contact_info.push(detail.ratings[i]) ;
            if (!missing_contact_info.length) {
                // already OK
                detail.show_hide = 'hide' ;
                return ;
            }

            while (missing_contact_info.length) {
                row = missing_contact_info.shift() ;
                wallets_directory_a = row.wallets_directory.split('/') ;
                user_seq = row.user_seq ;
                hub = wallets_directory_a[0] ;
                auth_address = wallets_directory_a[3] ;

                if (self.is_logged_in() && (hub == z_cache.my_user_hub) && (auth_address == ZeroFrame.site_info.auth_address) && (user_seq == z_cache.user_seq)) {
                    // logged in user
                    avatar_obj = moneyNetworkService.get_avatar();
                    //avatar = {
                    //    "src": "merged-MoneyNetwork/1PgyTnnACGd1XRdpfiDihgKwYRRnzgz2zh/data/users/18DbeZgtVCcLghmtzvg4Uv8uRQAwR8wnDQ/avatar.jpg",
                    //    "loaded": true
                    //};
                    if (avatar_obj.src) {
                        avatar_a = avatar_obj.src.split('/') ;
                        if (['avatar.jpg','avatar.png'].indexOf(avatar_a[avatar_a.length-1]) != -1) {
                            // uploaded avatar. avatar = jpg/png
                            avatar = avatar_a[avatar_a.length-1].split('.')[1] ;
                        }
                        else {
                            // random assigned public avatar.
                            avatar = avatar_obj.src.substr(20) ;
                        }
                    }
                    else avatar = z_cache.user_setup.avatar ;
                    search = [{ tag: 'Online', value: row.last_online || row.wallets_modified, privacy: 'Search', row: 1, debug_info: {}}] ;
                    user_info = moneyNetworkService.get_user_info() ;
                    for (i=0 ; i<user_info.length ; i++) {
                        if (user_info[i].privacy != 'Search') continue ;
                        search.push(JSON.parse(JSON.stringify(user_info[i]))) ;
                    }
                    row.contact = {
                        hub: hub,
                        auth_address: auth_address,
                        cert_user_id: row.wallets_cert_user_id,
                        user_seq: user_seq,
                        search: search,
                        alias: z_cache.user_setup.alias,
                        avatar: avatar,
                        pubkey: MoneyNetworkHelper.getItem('pubkey'),
                        "$$hashKey": row["$$hashKey"]
                    } ;
                    console.log(pgm + 'Me: contact = ' + JSON.stringify(row.contact)) ;
                    continue ;
                }
                if (self.is_logged_in()) {
                    // get contact info from ls_contacts
                    for (i=0 ; i<ls_contacts.length ; i++) {
                        if ((ls_contacts[i].hub == hub) && (ls_contacts[i].auth_address == auth_address) && (ls_contacts[i].user_seq == user_seq)) {
                            row.contact = ls_contacts[i] ;
                            console.log(pgm + 'ls contact = ' + JSON.stringify(row.contact)) ;
                            break ;
                        }
                    }
                }
                if (!row.contact) {
                    // not logged in - or contact not found in ls_contacts.
                    // contact info from mn_query_22
                    search = [{ tag: 'Online', value: row.last_online || row.wallets_modified}] ;
                    tags1 = row.tags1 ; // search group_concat separated by ,
                    tags2 = row.tags2 ; // search group_concat separated by #
                    while (tags1) {
                        // find tag
                        pos1 = 0 ;
                        while (tags1.charAt(pos1) == tags2.charAt(pos1)) pos1++ ;
                        // find value
                        pos2 = pos1 + 1 ;
                        while ((pos2 < tags1.length) && (tags1.charAt(pos2) == tags2.charAt(pos2))) pos2++ ;
                        // push
                        search.push({tag: tags1.substr(0,pos1), value: tags1.substr(pos1+1,pos2-pos1-1)}) ;
                        tags1 = tags1.substr(pos2+1) ;
                        tags2 = tags2.substr(pos2+1) ;
                    }
                    row.contact = {
                        hub: hub,
                        auth_address: auth_address,
                        cert_user_id: row.wallets_cert_user_id,
                        user_seq: user_seq,
                        search: search,
                        avatar: row.avatar || 'z.png'
                    } ;
                    console.log(pgm + 'not logged in contact = ' + JSON.stringify(row.contact)) ;
                }
            } // while

            // console.log(pgm + 'detail with contact info = ' + JSON.stringify(detail)) ;

            // update angularJS
            detail.show_hide = 'hide' ;

        }; // show_details2

        //self.chat_contact = function (contact) {
        //    var pgm = controller + '.chat_contact: ' ;
        //    console.log(pgm + 'contact = ' + JSON.stringify(contact)) ;
        //
        //}; // chat_contact


        // filter money systems
        // - avg rating >= n hearts
        // - last online. include only rating and reviews for users last online within n months
        // - todo: wallet name filter (wild card)
        // - todo: currency filter (name)
        // - todo: ?

        self.show_filters = false ;
        self.show_hide_filers = function() {
            self.show_filters = !self.show_filters ;
        } ;

        self.filters = [{name: '', value: ''}] ;
        self.filter_names = [
            {   name: 'Avg. rating',
                values: ['All', '>= 4 ❤️️❤️️❤️️❤️️ hearts', '>= 3 ❤️️❤️️❤️️ hearts', '>= 2 ❤️️❤️️ hearts'],
                filter_wallet: function (wallet, filter) {
                    var selected_value_a, selected_value ;
                    if (!wallet.ratings || (typeof wallet.ratings.avg_rating != 'number')) return false ;
                    if (filter.name != 'Avg. rating') return false ; // error
                    if (filter.value == 'All') return true ;
                    selected_value_a = filter.value.split(' ') ;
                    selected_value = parseInt(selected_value_a[1]) ;
                    return (wallet.ratings.avg_rating >= selected_value) ;
                }
            },
            {
                name: 'Last online',
                values: ['All', 'Within last month', 'Within last 3 months', 'Within last 6 months', 'Within last 12 months'],
                filter_wallet: function (wallet, filter) {
                    // see calc_avg_rating()
                    return true ;
                }
            }
        ];
        self.get_filter_values = function (filter) {
            var pgm = controller + '.get_filter_values: ' ;
            var i ;
            if (!filter.name) return [] ;
            for (i=0 ; i<self.filter_names.length ; i++) {
                if (self.filter_names[i].name == filter.name) return self.filter_names[i].values ;
            }
            return [] ;
        };
        self.insert_filter_row = function (filter) {
            var pgm = controller + '.insert_filter_row: ' ;
            var index ;
            for (var i=0 ; i<self.filters.length ; i++) if (self.filters[i].$$hashKey == filter.$$hashKey) index = i ;
            index = index + 1 ;
            self.filters.splice(index, 0, {name: '', value: ''});
            $scope.$apply();
        };

        self.filter_name_changed = function (filter) {
            var pgm = controller + '.filter_name_changed: ' ;
            var i ;
            // reset value
            filter.value = '' ;
            // add check function
            for (i=0 ; i<self.filter_names.length ; i++) {
                if (self.filter_names[i].name == filter.name) {
                    (function(){
                        var filter_wallet = self.filter_names[i].filter_wallet ;
                        filter.filter_wallet = function (wallet) { return filter_wallet(wallet, filter) }
                    })() ;
                    return ;
                }
            } // i
        } ; // self.filter_name_changed

        self.filter_value_changed = function (filter) {
            var pgm = controller + '.filter_name_changed: ' ;
            if (filter.name == 'Last online') calc_avg_rating();
        } ;

        self.filter_text = function() {
            var msg, i ;
            if (self.show_filters) return '' ;
            msg = [] ;
            for (i=0 ; i < self.filters.length ; i++) {
                if (self.filters[i].name && self.filters[i].value) msg.push(self.filters[i].name + ' ' + self.filters[i].value) ;
            }
            if (msg.length == 0) return 'No filters. Showing all known wallets, ratings and reviews' ;
            return msg.join(', ') ;
        }; // filter_text

        self.filter_wallets = function (wallet, index, wallets) {
            var pgm = controller + '.filter_wallets: ' ;
            var i ;
            for (i=0 ; i<self.filters.length ; i++) {
                if (!self.filters[i].name || !self.filters[i].value) continue ;
                if (!self.filters[i].filter_wallet(wallet)) return false ;
            }
            return true ;
        } ;

        // end MoneyCtrl
    }])

;