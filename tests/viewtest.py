import requests
import time

REPLICA1_PORT = '8082'
REPLICA2_PORT = '8083'

REPLICA1_URL = 'http://localhost:8082/key-value-store-view'
REPLICA2_URL = 'http://localhost:8083/key-value-store-view'
REPLICA3_URL = 'http://localhost:8084/key-value-store-view'

## Request functions

def getviewOp(url):
    # get the view from replica1
    response = requests.get(url)
    responseInJson = response.json()
    print(responseInJson)
    print(response.status_code)
    # put to the view from replica1

def putviewOp(url):
    response = requests.put(url, json={'socket-address' :'10.10.0.5:8085'})
    responseInJson = response.json()
    print(responseInJson)
    print(response.status_code)

def deleteviewOp(url):
    response = requests.delete(url, json={'socket-address' :'10.10.0.5:8085'})
    responseInJson = response.json()
    print(responseInJson)
    print(response.status_code)

## run operations
def putkvOp(port, key, val, cm):
    response = requests.put('http://localhost:'+ port +'/key-value-store/' + key, json={'value' : val, 'causal-metadata': cm})
    responseInJson = response.json()
    print(responseInJson)
    print(response.status_code)
    return responseInJson['causal-metadata']


def getkvOp(port, key, cm):
    response = requests.get( 'http://localhost:'+ port +'/key-value-store/' + key, json={'causal-metadata': cm} )
    responseInJson = response.json()
    print(responseInJson)
    print(response.status_code)
    return responseInJson['causal-metadata']

def deletekvOp(port, key, cm):
    response = requests.delete('http://localhost:'+ port +'/key-value-store/' + key, json={'causal-metadata' : cm})
    responseInJson = response.json()
    print(responseInJson)
    print(response.status_code)
    return responseInJson['causal-metadata']

def putNode(port, key, socketAdd):
    response = requests.put('http://localhost:'+ port +'/key-value-store-shard/add-member/' + key, json={'socket-address' : socketAdd})
    responseInJson = response.json()
    print(responseInJson)
    print(response.status_code)


## Unit Tests

# Assume two empty replicas are running --  REPLICA1 and REPLICA2
def test1():
    lastCm = putkvOp(REPLICA1_PORT, "alice", "I AM ALICE", '')
    lastCm = putkvOp(REPLICA1_PORT, "bob", "I AM BOB", lastCm)

def test2():
    lastCm = putkvOp(REPLICA1_PORT, "alice", "I AM ALICE", '')
    lastCm = putkvOp(REPLICA2_PORT,'bob', 'I AM BOB', lastCm)

def test3():
    lastCm = putkvOp(REPLICA1_PORT, "alice", "I AM ALICE", '')
    lastCm = putkvOp(REPLICA1_PORT, "bob", "I AM BOB", lastCm)
    lastCm = putkvOp(REPLICA1_PORT, "carol", "I AM CAROL", lastCm)
    lastCm = deletekvOp(REPLICA2_PORT, "carol", lastCm)

def test4():
    lastCm = putkvOp(REPLICA1_PORT, "alice", "I AM ALICE", '')
    deletekvOp(REPLICA1_PORT, "alice", lastCm)

def test5():
    lastCm = putkvOp(REPLICA1_PORT, "alice", "I AM ALICE", '')
    lastCm = putkvOp(REPLICA1_PORT, "bob", "I AM BOB", lastCm)
    lastCm = putkvOp(REPLICA1_PORT, "carol", "I AM CAROL", lastCm)
    lastCm = getkvOp(REPLICA2_PORT, "alice", '')
    getkvOp(REPLICA1_PORT, "alice", '')




if __name__ == '__main__':
    # test5()
    # # { '10.10.0.2': 0, '10.10.0.3': 0}
    # vc = putkvOp('8082', 'key0', 'value0', '')

    # vc = putkvOp('8083', 'key1', 'value1', vc)

    # vc = putkvOp('8084', 'key2', 'value2', vc)

    # vc = putkvOp('8085', 'key3', 'value3', vc)

    # vc = putkvOp('8082', 'key4', 'value4', vc)

    # vc = putkvOp('8083', 'key5', 'value5', vc)

    # vc = putkvOp('8084', 'key6', 'value6', vc)

    # vc = putkvOp('8085', 'key7', 'value7', vc)

    # vc = putkvOp('8082', 'key8', 'value8', vc)

    # vc = putkvOp('8083', 'key9', 'value9', vc)

    # vc = putkvOp('8084', 'key10', 'value10', vc)
    vc = ''
    for i in range(500):
        j = (i%6) + 2
        vc = putkvOp('808'+str(j), 'key'+str(i), 'value'+str(i), vc)

    for i in range(500):
        j = (i%6) + 2
        getkvOp('808'+str(j), 'key'+str(i), '')

    # putNode('8082', '1', '10.10.0.5:8085')
    # getviewOp(REPLICA1_URL)