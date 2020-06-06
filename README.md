# CSE138_Assignment4
A sharded, fault-tolerant key-value store, with better fault tolerance, capacity, and throughput than a single-site key-value store can offer.
# How to Run:
Run docker desktop and make sure it is working by running:
```
python3 test_suite.py
```
If "OK" is printed at the end of the test, you are all set to run your own tests. To do so, you can simply use
```
python3 tests/dockerRun.py
```
to run 6 nodes in 2 shards. You chose which replicas to run in dockerRun.py and you can add replicas if you'd like. You can also change the shard count in dockerRun.py. Be sure to stop and remove instances and the subnet before you exit out.
# Endpoints
1. /key-value-store/:key
  - Send PUT, GET, and DELETE requests on the key-value store
2. /key-value-store-view
  - Send PUT, GET, and DELETE requests on the view (a list of all running nodes in the system)
3. /key-value-store-shard/shard-ids
  - GET a list of shard ids for each shard in the system
4. /key-value-store-shard/node-shard-id
  - GET the shard id of the node you are contacting
5. /key-value-store-shard/shard-id-members/:key
  - GET a list of the members of a shard with id key
6. /key-value-store-shard/shard-id-key-count/:key
  - GET the number of keys stored in shard with id key
7. /key-value-store-shard/add-member/:key
  - PUT a new node in a shard. Run this after a new node is run without a shard count. There is a function available for this in dockerRun.py named runNewReplica() which uses the "newview". If you'd like to add more nodes, newview must be updated.
8. /key-value-store-shard/reshard
  - change the number of shards using a PUT with "shard-count" in the body of the request
  -example:
 ```
 curl --request PUT --header "Content-Type: application/json" --write-out "\n%{http_code}\n" --data'{"shard-count": 2 }' http://localhost:8082/key-value-store-shard/reshard
```
