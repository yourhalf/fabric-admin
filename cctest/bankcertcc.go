/*
Copyright SK Holdings Corp. 2017 All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

		 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

// This chaincode implements to manage bank related data that is stored in the state.
// The following operations are available.

// Invoke operations
// getUserInfo - get User Info by Client No.
// storeUserInfo - Store User Info
// verifySignature - Verify user signature and user certificate.

// SimpleChaincode example simple Chaincode implementation
type SimpleChaincode struct {
}

type BankCertInfo struct {
	Client_No  string `json:"client_no"`
	Cert_Hash  string `json:"cert_hash"`
	Bank_Name  string `json:"bank_name"`
	Issue_Time string `json:"issue_time"`
}

// Init is a no-op
func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	return shim.Success(nil)
}

// Invoke has two functions
// put - takes two arguements, a key and value, and stores them in the state
// remove - takes one argument, a key, and removes if from the state
func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	function, args := stub.GetFunctionAndParameters()
	switch function {
	case "storeUserInfo":
		if len(args) < 4 {
			return shim.Error("put operation must include 4 arguments, a key and value")
		}

		bankCertInfo := BankCertInfo{}
		bankCertInfo.Client_No = args[0]
		bankCertInfo.Cert_Hash = args[1]
		bankCertInfo.Bank_Name = args[2]
		bankCertInfo.Issue_Time = args[3]

		fmt.Println(bankCertInfo.Client_No, "- storeUserInfo")
		jsonAsBytes, err := json.Marshal(bankCertInfo)

		err = stub.PutState(args[0], jsonAsBytes)
		if err != nil {
			return shim.Error(err.Error())
		}

		return shim.Success(nil)

	case "getUserInfo":
		if len(args) < 1 {
			return shim.Error("get operation must include one argument, a key")
		}
		client_No := args[0]
		value, err := stub.GetState(client_No)
		if err != nil {
			return shim.Error(fmt.Sprintf("get operation failed. Error accessing state: %s", err))
		}
		return shim.Success(value)


	default:
		return shim.Success([]byte("Unsupported operation"))
	}
}

func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		fmt.Printf("Error starting chaincode: %s", err)
	}
}
