// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { SentinelRegistry } from "../src/SentinelRegistry.sol";
import { DefenseExecutor } from "../src/DefenseExecutor.sol";
import { MockERC20 } from "../src/MockERC20.sol";
import { MockExploitFixture } from "../src/MockExploitFixture.sol";

contract DeployPortalSentinel is Script {
    function run() external {
        // No default key: deployment must be explicit about which operator pays and signs.
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=================================================");
        console.log("Deploying PortalSentinel to Portaldot V3 EVM");
        console.log("Chain ID: 420420777 (test-evm-rpc-v3.portaldot.dev)");
        console.log("Deployer:", deployer);
        console.log("=================================================");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy SentinelRegistry
        SentinelRegistry registry = new SentinelRegistry(deployer);
        console.log("SentinelRegistry deployed at:", address(registry));

        // 2. Deploy DefenseExecutor
        DefenseExecutor executor = new DefenseExecutor(address(registry));
        console.log("DefenseExecutor deployed at:", address(executor));

        // 3. Link Executor in Registry
        registry.setDefenseExecutor(address(executor));
        console.log("Linked DefenseExecutor in SentinelRegistry");

        // 4. Deploy MockERC20
        MockERC20 mockToken = new MockERC20("Portaldot USD", "pUSD");
        mockToken.setGuardianExecutor(address(executor));
        console.log("MockERC20 (pUSD) deployed at:", address(mockToken));

        // 5. Deploy MockExploitFixture
        MockExploitFixture drainer = new MockExploitFixture();
        console.log("MockExploitFixture deployed at:", address(drainer));

        vm.stopBroadcast();

        console.log("=================================================");
        console.log("PortalSentinel Deployment Complete!");
        console.log("=================================================");
    }
}
