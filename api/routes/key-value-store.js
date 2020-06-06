const fetch = require('node-fetch');
const waitUntil = require('wait-until');
var FormData = require('form-data');
var crypto = require('crypto')

const STATUS_OK = 200;
const STATUS_ERROR = 400;
const STATUS_DNE = 404;
const STATUS_CREAT = 201;
const STATUS_DOWN = 503;
const TIMEOUT = 5000
const RETRIES = 5
const CAUSALMETA = "causal-metadata"

// Initialize local Database and Vector Clock
// let DB = {}
// let CM_DB = {}
globalVectorClock = initializeVectorClock()
console.log("Initial VectorClock: " + JSON.stringify(globalVectorClock))

function initializeVectorClock() {
    vectorClock = {}
    for(let i = 0; i < globalView.length; i++){
        vectorClock[globalView[i]] = 0
    }
    return vectorClock
}

// Check the CM of a client request
 function safeCheck(clientRequest, res, next){
    if (clientRequest.body.hasOwnProperty(CAUSALMETA)){
        clientVC = clientRequest.body[CAUSALMETA]
        // if no causal-metadata keep going 
        if(clientVC == ''){
            console.log("NO CM")
            next()
        }
        else{
            if(isSafe(clientVC)){
                console.log("IS SAFE")
                next()
            }
            else{
                console.log("NOT SAFE WAITING ...")
                // wait until safe to fulfill request
                waitUntil()
                    .interval(TIMEOUT)
                    .times(RETRIES)
                    .condition(() => {
                        return isSafe(clientVC); 
                    })
                    .done((result) => {
                        if(result == true){
                            console.log("SAFE CONDITIONS FULFILLED")
                            next()
                        }
                        else{
                            //TODO what do timeout?
                            console.log("TODO: WHAT DO ON TIMEOUT?")
                            process.exit(1)
                        }
                    });
                }
        }
    }
    else{
        //TODO: What if causal-metadata is not a field???
        console.log("TODO: WHAT IF CM NOT IN BODY??")
        process.exit(1)
    }
}

 // safe = client CM must be less than or equal to local VC or CONCURRENT
 function isSafe(clientVC){
     // clientVC <= localVC
    if(compareVectorClocks(clientVC, globalVectorClock) == true){
        return true
    }
    // vc's are concurrent
    else if( (compareVectorClocks(clientVC, globalVectorClock) == false) && (compareVectorClocks(globalVectorClock, clientVC) == false) ){
        return true
    }
    return false
 }

 // Returns true if VC1 if less than or equal to VC2 and false otherwise
 function compareVectorClocks(VC1, VC2){
    for(let [key, value] of Object.entries(VC2)){
        if(key in globalShards[thisID])
        {
            if (VC1[key] > VC2[key]){
                return false            
            } 
        }
    }
    return true
 }

 // Returns true if VC1 is less than or equal to VC2 for all positions except 1 and false otherwise
 function isOkay(req){
    sendersAddress = req.body['address']
    sendersVectorClock = req.body[CAUSALMETA]
    // T[pos] = VC[pos] + 1
    if(sendersAddress in globalShards[thisID])
    {
        if(sendersVectorClock[sendersAddress] == globalVectorClock[sendersAddress] + 1){
            //T[K] <= VC[K] for all K
            for(let [key, value] of Object.entries(globalVectorClock)){
                if(key in globalShards[thisID])
                {
                    if(key == sendersAddress){
                        continue
                    }
                    else{
                        if(sendersVectorClock[key] > globalVectorClock[key]){
                            return false
                        }
                    }
                }
            }
            return true
        }
        else{
            return false
        }
    } else 
    {
        return true
    }
 }

function makeRequestObject(forward_address, source_req) {
    let protocal = source_req.protocol     // "https"
    let hostname = forward_address         // "google.com"
    let path = source_req.path             // "/api"
    let method = source_req.method         // "GET" 

    // Add 'node' field and senders socket address to broadcasts
    if(source_req.body)
    {
        source_req.body['node'] = true
        source_req.body['address'] = globalSocketAddress
        source_req.body[CAUSALMETA] = globalVectorClock
    }

    let url = `${protocal}://${hostname}${path}`
    let body = JSON.stringify(source_req.body)

    let options = {
        'method': `${method}`,
        headers: {'Content-Type': 'application/json'},
        ...(method !== "GET" && {'body': `${body}`}),
    }
    return {url, options}
}

// Broadcast request to all nodes listed in globalView
function broadcast(req, res){
    globalShards[thisID].forEach(element => {
        if(element != process.env.SOCKET_ADDRESS)
        {
            let forward_address = element
            let {url, options} = makeRequestObject(forward_address, req)
            //console.log(url, options)
            fetch(url, options)
                .then(f_res => f_res.json().then(json_f_res => console.log(json_f_res)))
                .catch(error => removeFromViews(error, element))
        }
    })
}

function removeFromViews(error, hostname)
{
    console.log('Response took too long. Now\n')
    //remove from globalView and globalVectorClock
    let urlIndex = globalView.indexOf(hostname)
    console.log("trying to delete from own VC. Hostname: ", hostname)
    delete globalVectorClock[hostname]
    if(urlIndex > -1)
    {
        let removedUrl = globalView.splice(urlIndex, 1)
        console.log(removedUrl, ' was removed from this nodes view!')
        //remove downed node from all other views
        globalView.forEach(element => {
            if(element != process.env.SOCKET_ADDRESS)
            {
                let url = `http://${element}/key-value-store-view`
                let body = {'socket-address': hostname, 'node': true}
                fetch(url, {
                    method: 'DELETE',
                    body: JSON.stringify(body),
                    headers: {'Content-Type': 'application/json'}
                })
                .then(res => res.json())
                .then(json => console.log(json, `\n ${hostname} successfully deleted from the view of ${element}`))
                .catch(error => removeFromViews(error, element))
            }
        })
    }
    else
    {
        console.log('in removeFromView: url doesnt exist in globalView')
    }
}


// Check if message is sent by client or node
function senderCheck(req, res, next){
    if(req.body.hasOwnProperty(CAUSALMETA)){
        if(req.body['node']){
            // node broadcast
            if(isOkay(req)){
                console.log("IS OKAY")
                globalVectorClock[globalSocketAddress]++
                next()
            }
            else{
                console.log("NOT OKAY, WAITING ...")
                console.log("local VC: ", globalVectorClock)
                console.log("senders VC: ", req.body['causal-metadata'])
                // wait until okay to fulfill request
                waitUntil()
                    .interval(TIMEOUT)
                    .times(RETRIES)
                    .condition(() => {
                        return isOkay(req); 
                    })
                    .done((result) => {
                        if(result == true){
                            console.log("OKAY CONDITIONS FULFILLED")
                            globalVectorClock[req.body['address']]++
                            next()
                        }
                        else{
                            //TODO what do timeout?
                            console.log("TODO: WHAT DO ON TIMEOUT?")
                            process.exit(1)
                        }
                    });
            }
        }
        else{
            // client request
            if(req.body[CAUSALMETA] == ''){
                // Message is safe and not causally dependent
                globalVectorClock[globalSocketAddress]++
                next()
            }
            else{
                // Message may not be safe
                if(isSafe(req.body[CAUSALMETA])){
                    console.log("IS SAFE")
                    globalVectorClock[globalSocketAddress]++
                    next()
                }
                else{
                    console.log("NOT SAFE, WAITING...")
                    waitUntil()
                    .interval(TIMEOUT)
                    .times(RETRIES)
                    .condition(() => {
                        return isSafe(req.body[CAUSALMETA]); 
                    })
                    .done((result) => {
                        if(result == true){
                            console.log("SAFE CONDITIONS FULFILLED")
                            globalVectorClock[globalSocketAddress]++
                            next()
                        }
                        else{
                            //TODO what do timeout?
                            console.log("TODO: WHAT DO ON TIMEOUT?")
                            process.exit(1)
                        }
                    });
                }
            }
        }
    }
    else{
        //TODO: What if causal-metadata is not a field???
        console.log("TODO: WHAT IF CM NOT IN BODY??")
        next()
    }
}

function routeGet (req, res, next) {
    let key = req.params['key'] 
    let doesExist = key in DB
    let targetID = hashToID(key)

    if(targetID !== thisID || !doesExist)
    {
        console.log(`forwarding ${req.method} request...`)
        forwardRequest(req, res, targetID)
        return
    }

    let cm
    // If key doesn't exist send no CM back
    if(doesExist){
        //  cm = CM_DB[key]
        cm = globalVectorClock
    }
    else{
        cm = ''
    }
    let msg = doesExist ? "Retrieved successfully" : 
                        "Error in GET"
    let message = {
        "doesExist" : doesExist,
    ...(!doesExist && {"error": "Key does not exist"}),
    "message" : msg,
    ...(doesExist && {"value": DB[key]}),
    "causal-metadata": cm
    }
    res.status(doesExist ? STATUS_OK : STATUS_DNE).send(message)
}


function routePut (req, res) {
    let key = req.params['key'];
    let value = req.body['value'];
    let targetID = hashToID(key)

    let doesExist = key in DB;
    let errBool = (value == null || key.length > 50);
    if(errBool)
    {
        let errMsg = (value == null)? 'Value is missing': 'Key is too long';
        res.status(STATUS_ERROR).json({
            error: errMsg,
            message: 'Error in PUT',
            "causal-metadata": globalVectorClock
        });
    } else
    {
        DB[key] = value;
        // make copy of globalVectorClock
        // CM_DB[key] = JSON.parse(JSON.stringify(globalVectorClock));
        let msg = doesExist? "Updated successfully": "Added successfully";
        res.status(doesExist? STATUS_OK: STATUS_CREAT).json({
            message: msg,
            replaced: doesExist,
            "causal-metadata": globalVectorClock,
            "shard-id": targetID,
        });
        // Determine if node broadcast or original client request
        if (req.body['node']) {
            console.log(JSON.stringify(req.body[CAUSALMETA]))
            console.log('PUT req from node, UPDATED VC: ' + JSON.stringify(globalVectorClock))
            console.log("+++")
        }
        else {
            console.log(JSON.stringify(req.body[CAUSALMETA]))
            console.log('PUT req from client-->broadcasting, UPDATED VC: ' + JSON.stringify(globalVectorClock))
            console.log("+++")
            broadcast(req, res)
        }
    }
}

function routeDelete (req, res) {
    let key = req.params['key']
    let doesExist = key in DB;
    let targetID = hashToID(key)

    if(doesExist) {
        delete DB[key]
    }
    
    let message = doesExist ? 
                    "Deleted successfully" :
                    "Error in DELETE"

    let response = {
        "doesExist": doesExist,
        ...(!doesExist && {"error": "Key does not exist"}),
        "message": message,
        "causal-metadata": globalVectorClock,
        "shard-id": targetID,
    }

    res.status(doesExist ? STATUS_OK : STATUS_DNE).send(response)
    // Determine if node broadcast or original client request
    if (req.body['node']) {
        console.log(JSON.stringify(req.body[CAUSALMETA]))
        console.log('DEL req from node, UPDATED VC: ' + JSON.stringify(globalVectorClock))
        console.log("+++")
    }
    else {
        console.log(JSON.stringify(req.body[CAUSALMETA]))
        console.log('DEL req from client-->broadcasting, UPDATED VC: ' + JSON.stringify(globalVectorClock))
        console.log("+++")
        broadcast(req, res)
    }
}

function checkShard(req, res, next)
{
    let key = req.params['key']
    let targetID = hashToID(key)
    if(targetID !== thisID)
    {
        console.log(`forwarding ${req.method} request...`)
        forwardRequest(req, res, targetID)
    } else 
    {
        next()
    }
}

function initDB(req, res)
{
    console.log('[initkv] get request from node')
    let cm = globalVectorClock
    let message = {
    "value": JSON.stringify(DB),
    "causal-metadata": JSON.stringify(cm)
    }
    res.status(STATUS_OK).send(message)
}

function forwardRequest(req, res, targetID){
    // Forward exists so 
    let {url, options} = makeReqObj(globalShards[targetID][0], req)
    //console.log(url, options)
    fetch(url, options)
        .then(f_res => f_res.json().then(json_f_res => handleForwardResponse(res, f_res, json_f_res)))
        .catch(error => handleErrorResponse(res, req.method, error))
    
}

function makeReqObj(forward_address, source_req) {
    let protocal = source_req.protocol     // "https"
    let hostname = forward_address     // "google.com"
    let path = source_req.path             // "/api"
    let method = source_req.method         // "GET" 
    let key = source_req.params['key']

    let url = `${protocal}://${hostname}${path}`
    let body = JSON.stringify(source_req.body)

    let options = {
        'method': `${method}`,
        headers: {'Content-Type': 'application/json'},
        ...(method !== "GET" && {'body': `${body}`}),
    }

    //console.log('body is: ', body)
    //console.log('options are:', options)
 
    return {url, options}
}

function handleForwardResponse(res, f_res, json_f_res){
    res.status(f_res.status).send(json_f_res)
}

function handleErrorResponse(res, method, error){

    if(error.errno == 'EHOSTUNREACH')
        res.status(STATUS_DOWN).send({'error': "Shard is down", 'message': `Error in ${method}`})
}

function hashToID(key)
{
    var h = 5381; 
    var i = 0; 
    for (i = 0; i < key.length; i++) {
        var ascii = key.charCodeAt(i);
        h = ((h << 5) + h) + ascii;
    }
    if((h & 0xffffffffff)<=0)
    {
      return -(h & 0xffffffffff)%shard_count
    }
    return (h & 0xffffffffff)%shard_count
}
// TODO: Only export functions still in use
module.exports = {
    safeCheck: safeCheck,
    senderCheck: senderCheck,
    routeGet: routeGet,
    routePut: routePut,
    routeDelete: routeDelete,
    initDB: initDB,
    checkShard: checkShard,
    hashToID: hashToID
};