// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { SentinelRegistry } from "../src/SentinelRegistry.sol";
import { DefenseExecutor } from "../src/DefenseExecutor.sol";
import { MockERC20 } from "../src/MockERC20.sol";
import { MockExploitFixture } from "../src/MockExploitFixture.sol";

contract PortalSentinelTest is Test {    SentinelRegistry public registry;
    DefenseExecutor public executor;
    MockERC20 public token;
    MockExploitFixture public drainer;

    address public owner = address(0x1);
    address public guardianBot = address(0x2);
    address public victimUser = address(0x3);
    address public coldSafe = address(0x4);
    address public hacker = address(0x5);

    function setUp() public {
        vm.startPrank(owner);
        // Deploy Registry and authorize guardianBot
        registry = new SentinelRegistry(guardianBot);
        // Deploy Executor referencing Registry
        executor = new DefenseExecutor(address(registry));
        // Register executor in registry
        registry.setDefenseExecutor(address(executor));

        // Deploy Mock ERC-20
        token = new MockERC20("Portaldot USD", "pUSD");
        token.setGuardianExecutor(address(executor));
        // Deploy Mock Drainer
        drainer = new MockExploitFixture();
        vm.stopPrank();

        // Fund victim with tokens
        token.mint(victimUser, 10_000 ether);
    }

    function test_RegisterAndActivateShield() public {
        vm.startPrank(victimUser);
        registry.registerShield(SentinelRegistry.DefenseMode.BALANCED, coldSafe);
        vm.stopPrank();

        assertTrue(registry.isProtected(victimUser));
        assertEq(registry.getEmergencySafe(victimUser), coldSafe);

        SentinelRegistry.UserPolicy memory policy = registry.getUserPolicy(victimUser);
        assertTrue(policy.isActive);
        assertEq(uint8(policy.mode), uint8(SentinelRegistry.DefenseMode.BALANCED));
    }

    function test_ValidationRulesForEmergencySafe() public {
        vm.startPrank(victimUser);
        // Cannot use address(0)
        vm.expectRevert("SentinelRegistry: Invalid emergency safe address");
        registry.registerShield(SentinelRegistry.DefenseMode.BALANCED, address(0));

        // Cannot use self (must be a distinct backup address)
        vm.expectRevert("SentinelRegistry: Emergency safe should be distinct backup address");
        registry.registerShield(SentinelRegistry.DefenseMode.BALANCED, victimUser);
        vm.stopPrank();
    }

    function test_BatchRevokeStopsDrainer() public {
        // Victim approves drainer contract for 5,000 tokens
        vm.startPrank(victimUser);
        registry.registerShield(SentinelRegistry.DefenseMode.AGGRESSIVE, coldSafe);
        token.approve(address(drainer), 5_000 ether);
        assertEq(token.allowance(victimUser, address(drainer)), 5_000 ether);
        vm.stopPrank();

        // Sentinel detects threat and executes batch revoke
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        address[] memory spenders = new address[](1);
        spenders[0] = address(drainer);

        vm.prank(guardianBot);
        executor.executeEmergencyBatchRevoke(victimUser, tokens, spenders, 95);

        // Allowance is now zeroed
        assertEq(token.allowance(victimUser, address(drainer)), 0);

        // Attacker attempts to drain, but call is blocked!
        vm.prank(hacker);
        vm.expectRevert("MockExploitFixture: Attack blocked by zeroed allowance");
        drainer.triggerDrain(address(token), victimUser, 1_000 ether);
    }

    function test_EmergencySweepMovesFundsStrictlyToColdSafe() public {
        // Victim registers cold safe and approves Sentinel Shield
        vm.startPrank(victimUser);
        registry.registerShield(SentinelRegistry.DefenseMode.BALANCED, coldSafe);
        token.approve(address(executor), 10_000 ether);
        vm.stopPrank();

        assertEq(token.balanceOf(victimUser), 10_000 ether);
        assertEq(token.balanceOf(coldSafe), 0);

        // Emergency sweep triggered
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);

        vm.prank(guardianBot);
        executor.executeEmergencySweep(victimUser, tokens, 95);

        // Tokens are moved strictly to coldSafe, NOT the bot
        assertEq(token.balanceOf(victimUser), 0);
        assertEq(token.balanceOf(coldSafe), 10_000 ether);
        assertEq(token.balanceOf(guardianBot), 0);
        assertEq(token.balanceOf(address(executor)), 0);

        // Real rescued amounts are accounted for
        assertEq(executor.totalAmountRescued(), 10_000 ether);
        assertEq(executor.totalSweepsExecuted(), 1);
    }

    function test_NonGuardianCannotTriggerDefense() public {
        vm.prank(victimUser);
        registry.registerShield(SentinelRegistry.DefenseMode.BALANCED, coldSafe);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        address[] memory spenders = new address[](1);
        spenders[0] = address(drainer);

        // Random address tries to call executor
        vm.prank(hacker);
        vm.expectRevert("DefenseExecutor: Caller is not an authorized guardian");
        executor.executeEmergencyBatchRevoke(victimUser, tokens, spenders, 95);
    }

    function test_SweepAccountingCountsOnlyMovedTokens() public {
        vm.startPrank(victimUser);
        registry.registerShield(SentinelRegistry.DefenseMode.BALANCED, coldSafe);
        token.approve(address(executor), 1_000 ether);
        vm.stopPrank();

        address[] memory tokens = new address[](1);
        tokens[0] = address(token);

        vm.prank(guardianBot);
        executor.executeEmergencySweep(victimUser, tokens, 95);

        assertEq(executor.totalAmountRescued(), 1_000 ether);
        assertEq(executor.totalSweepsExecuted(), 1);
        assertEq(token.balanceOf(coldSafe), 1_000 ether);

        // A second sweep has no allowance left: it must revert and leave the
        // cumulative accounting untouched rather than count a phantom rescue.
        vm.prank(guardianBot);
        vm.expectRevert("DefenseExecutor: No tokens rescued");
        executor.executeEmergencySweep(victimUser, tokens, 95);

        assertEq(executor.totalAmountRescued(), 1_000 ether);
        assertEq(executor.totalSweepsExecuted(), 1);
    }

    // ─── Hardening tests ────────────────────────────────────────────────────────

    function test_BatchRevokeRevertsWhenTokenLacksGuardianHook() public {
        // A standard ERC-20 cannot be revoked by a third party.
        PlainERC20 plainToken = new PlainERC20();

        vm.startPrank(victimUser);
        registry.registerShield(SentinelRegistry.DefenseMode.BALANCED, coldSafe);
        plainToken.approve(address(drainer), 1_000 ether);
        vm.stopPrank();

        address[] memory tokens = new address[](1);
        tokens[0] = address(plainToken);
        address[] memory spenders = new address[](1);
        spenders[0] = address(drainer);

        vm.prank(guardianBot);
        vm.expectRevert("DefenseExecutor: No allowances revoked");
        executor.executeEmergencyBatchRevoke(victimUser, tokens, spenders, 95);
    }

    function test_EmergencySweepRevertsWithoutApproval() public {
        vm.prank(victimUser);
        registry.registerShield(SentinelRegistry.DefenseMode.BALANCED, coldSafe);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token);

        vm.prank(guardianBot);
        vm.expectRevert("DefenseExecutor: No tokens rescued");
        executor.executeEmergencySweep(victimUser, tokens, 95);
    }

    function test_GuardianCannotSweepToItself() public {
        // The victim's cold safe is the guardian operator: the invariant must block it.
        vm.startPrank(victimUser);
        registry.registerShield(SentinelRegistry.DefenseMode.BALANCED, guardianBot);
        token.approve(address(executor), 1_000 ether);
        vm.stopPrank();

        address[] memory tokens = new address[](1);
        tokens[0] = address(token);

        vm.prank(guardianBot);
        vm.expectRevert("DefenseExecutor: Zero-custody invariant violated");
        executor.executeEmergencySweep(victimUser, tokens, 95);
    }

    function test_PausedRegistryBlocksDefenseAndEnrollment() public {
        vm.prank(victimUser);
        registry.registerShield(SentinelRegistry.DefenseMode.BALANCED, coldSafe);

        vm.prank(owner);
        registry.pause();

        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        address[] memory spenders = new address[](1);
        spenders[0] = address(drainer);

        vm.prank(guardianBot);
        vm.expectRevert("DefenseExecutor: Registry is paused");
        executor.executeEmergencyBatchRevoke(victimUser, tokens, spenders, 95);

        vm.prank(hacker);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.registerShield(SentinelRegistry.DefenseMode.BALANCED, coldSafe);
    }

    function test_BatchRevokeRevertsOnEmptyBatch() public {
        vm.prank(victimUser);
        registry.registerShield(SentinelRegistry.DefenseMode.BALANCED, coldSafe);

        address[] memory tokens = new address[](0);
        address[] memory spenders = new address[](0);

        vm.prank(guardianBot);
        vm.expectRevert("DefenseExecutor: Empty batch");
        executor.executeEmergencyBatchRevoke(victimUser, tokens, spenders, 95);
    }

    function testFuzz_SweepNeverExceedsAllowanceOrBalance(
        uint96 allowanceAmount,
        uint96 balanceAmount
    ) public {
        uint256 allowance = bound(uint256(allowanceAmount), 0, 10_000 ether);
        uint256 balance = bound(uint256(balanceAmount), 0, 10_000 ether);

        vm.startPrank(victimUser);
        registry.registerShield(SentinelRegistry.DefenseMode.BALANCED, coldSafe);
        if (allowance > 0) {
            token.approve(address(executor), allowance);
        }
        vm.stopPrank();

        // setUp already minted 10k; mint an additional bounded amount to control the balance.
        token.mint(victimUser, balance);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token);

        uint256 victimBefore = token.balanceOf(victimUser);
        uint256 expected = allowance < victimBefore ? allowance : victimBefore;

        vm.prank(guardianBot);
        if (expected == 0) {
            vm.expectRevert("DefenseExecutor: No tokens rescued");
            executor.executeEmergencySweep(victimUser, tokens, 95);
        } else {
            executor.executeEmergencySweep(victimUser, tokens, 95);
            assertEq(token.balanceOf(coldSafe), expected);
            assertEq(token.balanceOf(victimUser), victimBefore - expected);
            assertEq(token.balanceOf(address(executor)), 0);
        }
    }
}

/// @dev Minimal concrete ERC-20 with no guardian hook, used to prove the silent-failure fix.
contract PlainERC20 is ERC20 {
    constructor() ERC20("Plain Token", "PLN") {}
}
