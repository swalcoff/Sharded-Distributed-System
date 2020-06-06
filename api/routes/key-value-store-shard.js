const fetch = require('node-fetch');
const waitUntil = require('wait-until');
const express = require('express')
var FormData = require('form-data');
const kvstore = require('./key-value-store')

const STATUS_OK = 200;
const STATUS_ERROR = 400;
const STATUS_DNE = 404;
const STATUS_CREAT = 201;
const STATUS_DOWN = 503;
const TIMEOUT = 5000
const RETRIES = 5
const CAUSALMETA = "causal-metadata"

function routeGetIDs (req, res) 
{
    let listShards = Object.keys(globalShards)
    // let message = 
    // {
	//     "message" : "Shard IDs retrieved successfully",
    // 	"shard-ids" : listShards,
    // }

    res.status(STATUS_OK).json({
        "message" : "Shard IDs retrieved successfully",
    	"shard-ids" : listShards.map(x=>+x),
    })
}

function routeGetNodeID (req, res) 
{
    // let message = 
    // {
	//     "message" : "Shard ID of the node retrived successfully",
    //     "shard-id" : thisID,
    // }

    res.status(STATUS_OK).json({
        "message" : "Shard ID of the node retrieved successfully",
        "shard-id" : parseInt(thisID, 10),
    })
}

function routeGetShardMembers (req, res) 
{
    let key = req.params['key'] 
    
    // let message = 
    // {
    // "message" : "Members of shard ID retrieved successfully",
    // "shard-id-members:": globalShards[key]
    // }

    res.status(STATUS_OK).json({
        "message" : "Members of shard ID retrieved successfully",
        "shard-id-members": globalShards[key]
    })
}

function handleForwardResponse(res, f_res, json_f_res){
    //console.log("Response from server was:", f_res)
    //console.log("STATUS = "+ f_res.status)
    res.status(f_res.status).send(json_f_res)
}

function handleErrorResponse(res, method, error){

    if(error.errno == 'EHOSTUNREACH')
        res.status(STATUS_DOWN).send({'error': "Shard is down", 'message': `Error in ${method}`})
}

function routeGetNumKeysInShard(req, res)
{
    let key = req.params['key']
    let len = Object.keys(DB).length
    
    if(key != thisID)
    {
        let url = `http://${globalShards[key][0]}/key-value-store-shard/shard-id-key-count/${key}`
        // let body = {'socket-address': hostname, 'node': true}
        fetch(url, {
            method: 'GET',
            // body: JSON.stringify(body),
            headers: {'Content-Type': 'application/json'}
        })
        .then(f_res => f_res.json().then(json_f_res => handleForwardResponse(res, f_res, json_f_res)))
        .catch(error => handleErrorResponse(res, req.method, error))
    } else
    {
        let message = 
        {
        "message" : "Key count of shard ID retrieved successfully",
        "shard-id-key-count": len,
        }

        res.status(STATUS_OK).send(message)
    }
    
}

function routePutNewNode(req, res)
{
    let key = req.params['key']
    let new_add = req.body['socket-address']
    let doesExist = new_add in globalView

    if(req.body['globalShards'])
    {
        if(globalSocketAddress == new_add)
        {
            shard_count = req.body['shard_count']
            thisID = key
            console.log("INSIDE THE IF. key: ", thisID)
        }
        if(!doesExist)
        {
            globalView.push(new_add)
        }
        console.log("type of received globalShards: ", typeof(req.body['globalShards']))
        console.log("globalShards: ", req.body['globalShards'])
        globalShards = req.body['globalShards']
        res.status(STATUS_OK).json({
            message: 'broadcast received at ' + globalSocketAddress,
        });
    } else {
        globalShards[key].push(new_add)
        // globalView.push(new_add)
        globalView.forEach(element => {
            if(element != process.env.SOCKET_ADDRESS)
            {
                let url = `http://${element}/key-value-store-shard/add-member/${key}`
                //console.log(url, options)
                let body = {'socket-address': new_add, 'globalShards': globalShards, 'shard_count': shard_count}
                fetch(url, {
                    method: 'PUT',
                    body: JSON.stringify(body),
                    headers: {'Content-Type': 'application/json'}
                })
                    .then(f_res => f_res.json().then(json_f_res => console.log(json_f_res)))
                    .catch(error => console.log("in routePutNewNode: ", error))
            }
        })
        let msg = {
            "message": 'PUT new node received and broadcasted'
        }
        res.status(STATUS_OK).send(msg)
    }

    globalView = globalView.filter((a, b) => globalView.indexOf(a) === b)
}

function failReshard(res){
    res.status(STATUS_ERROR).send({"message":"Not enough nodes to provide fault-tolerance with the given shard count!"})
}

function broadcast(req, res){
    globalView = globalView.filter((a, b) => globalView.indexOf(a) === b)
    globalView.forEach(element => {
        if(element != process.env.SOCKET_ADDRESS)
        {
            let forward_address = element
            let {url, options} = makeRequestObject(forward_address, req)
            //console.log(url, options)
            fetch(url, options)
                .then(f_res => f_res.json().then(json_f_res => console.log(json_f_res)))
                .catch(error => console.log("error from shard PUT(resharding): ", error))
        }
    })
}

function makeRequestObject(forward_address, source_req) {
    let protocal = source_req.protocol     // "https"
    let hostname = forward_address         // "google.com"
    let path = source_req.path             // "/api"
    let method = source_req.method         // "GET" 

    // Add 'node' field and senders socket address to broadcasts
    source_req.body['node'] = true

    let url = `${protocal}://${hostname}${path}`
    let body = JSON.stringify(source_req.body)

    let options = {
        'method': `${method}`,
        headers: {'Content-Type': 'application/json'},
        ...(method !== "GET" && {'body': `${body}`}),
    }
    return {url, options}
}

function setShard()
{
    for(let i = 0; i < shard_count; i++)
    {
        globalShards[i] = []
    }
    for(let i = 0; i < globalView.length; i++)
    {
        if(globalView[i] == globalSocketAddress)
        {
            thisID = i%shard_count
        }
        globalShards[i%shard_count].push(globalView[i])
    }
}

function passReshard(req, res, requested_shard_count){

    // Update the shard count
    shard_count = requested_shard_count

    setShard()

    if(!req.body['node']) //if it's from another node
    {
        broadcast(req, res)
    }

    for(key in DB)
    {
        let target_id = kvstore.hashToID(key)
        if(target_id !== thisID)
        {
            let url = `http://${globalShards[target_id][0]}/key-value-store/${key}`
            let options = {
                'method':"PUT",
                'headers': {'Content-Type': 'application/json'},
                'body': JSON.stringify({'value': DB[key]}),
                'reshard': true
            }
            fetch(url, options)
                .then(f_res => f_res.json().then(json_f_res => console.log(json_f_res)))
                .catch(error => console.log(error))

            delete DB[key]
        }
    }

    res.status(STATUS_OK).send({"message":"Resharding done successfully"})
}

function routePutReshard(req, res){
    let requested_shard_count = parseInt(req.body['shard-count'], 10)
    let live_count = globalView.length

    if(live_count / requested_shard_count >= minNodesNeeded) 
        passReshard(req, res, requested_shard_count)
    else 
        failReshard(res)
    
}

module.exports = 
{
    routeGetIDs: routeGetIDs,
    routeGetNodeID: routeGetNodeID,
    routeGetShardMembers: routeGetShardMembers,
    routeGetNumKeysInShard: routeGetNumKeysInShard,
    routePutNewNode: routePutNewNode,
    routePutReshard: routePutReshard
}
