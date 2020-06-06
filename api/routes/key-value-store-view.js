const fetch = require('node-fetch');


const STATUS_OK = 200;
const STATUS_ERROR = 400;
const STATUS_DNE = 404;
const STATUS_CREAT = 201;
const STATUS_DOWN = 503;

function routeGet (req, res) {
    let msg = "View retrieved successfully"
    res.status(STATUS_OK).json({
        message: msg,
        "view": globalView
    });
}

function routePut (req, res) {
    let socket_address = req.body['socket-address'];
    let index = globalView.indexOf(socket_address)
    let doesExist = index !== -1

    let msg = (doesExist? "Error in PUT": "Replica added successfully to the view")

    if(doesExist)
    {
        res.status(STATUS_DNE).json({
            error: "Socket address already exists in the view",
            message: msg
        })
    } else
    {
        globalView.push(socket_address)
        res.status(STATUS_CREAT).json({
            message: msg
        })
    }
    updateVectorClock(req.method, socket_address)
    if (req.body['node']) {
        console.log('[VIEW] put req from node.')
    }
    else {
        console.log('[VIEW] put req from client. broadcasting...')
        broadcast(req, res, socket_address)
    }

}

function routeDelete (req, res) {
    let socket_address = req.body['socket-address'];
    let index = globalView.indexOf(socket_address)
    let doesExist = index !== -1

    console.log('socket_address: ', socket_address)

    let msg = (doesExist? "Replica deleted successfully from the view": "Error in DELETE")

    if(doesExist)
    {
        globalView.splice(index, 1)
        res.status(STATUS_OK).json({
            message: msg
        })
    } else
    {
        res.status(STATUS_DNE).json({
            error: "Socket address does not exist in the view",
            message: msg
        })
    }
    updateVectorClock(req.method, socket_address)
    if (req.body['node']) {
        console.log('[VIEW] del req from node.')
    }
    else {
        console.log('[VIEW] del req from client. broadcasting...')
        broadcast(req, res, socket_address)
    }
}

function updateVectorClock(method, socketAddress){
    if(method == "PUT"){
        globalVectorClock[socketAddress] = 0
    }
    // method == "DELETE"
    else{
        console.log('node request received, deleting from the VC')
        delete globalVectorClock[socketAddress]
    }
    console.log("UPDATED VC = " + JSON.stringify(globalVectorClock))
}

// Broadcast request to all nodes listed in globalView except the newly added view. 
function broadcast(req, res, addedSocketAddress){
    globalView.forEach(element => {
        if(element != process.env.SOCKET_ADDRESS && element != addedSocketAddress)
        {
            let forward_address = element
            let {url, options} = makeRequestObject(forward_address, req)
            fetch(url, options)
                .then(f_res => f_res.json().then(json_f_res => console.log(json_f_res)))
                .catch(error => console.log(error))
        }
    })
}

function makeRequestObject(forward_address, source_req) {
    let protocal = source_req.protocol     // "https"
    let hostname = forward_address         // "google.com"
    let path = source_req.path             // "/api"
    let method = source_req.method         // "GET" 

    // Add 'node' field to requests
    if(source_req.body)
    {
        source_req.body['node'] = true
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

module.exports = {
    routeGet: routeGet,
    routePut: routePut,
    routeDelete: routeDelete
};