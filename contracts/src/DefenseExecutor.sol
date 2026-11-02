// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SentinelRegistry } from "./SentinelRegistry.sol";

interface IGuardianRevocable {
    function guardianRevokeApproval(address owner, address spender) external;
}

/**
 * @title DefenseExecutor
 * @notice The autonomous on-chain execution firewall for PortalSentinel on Portaldot V3.
 *         Executes atomic circuit breaker actions (batch revokes and emergency sweeps to cold vaults)
 *         with zero custodial privileges for the bot operator.
 */
contract DefenseExecutor is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ──────────────────────────────────────────────────────────────────
    SentinelRegistry public immutable registry;

    /// Total token amount (in token base units) swept to emergency safes.
    uint256 public totalAmountRescued;

    /// Number of token sweeps that moved a non-zero balance.
    uint256 public totalSweepsExecuted;

    // ─── Events ─────────────────────────────────────────────────────────────────
    event EmergencyRevokeExecuted(
        address indexed user,
        address indexed token,
        address indexed spender,
        address operator,
        uint256 timestamp
    );

    event EmergencyRevokeFailed(
        address indexed user,
        address indexed token,
        address indexed spender,
        string reason
    );

    event EmergencySweepExecuted(
        address indexed user,
        address indexed token,
        address indexed emergencySafe,
        uint256 amountRescued,
        uint256 timestamp
    );

    event ThreatNeutralized(
        address indexed user,
        address indexed threatSpender,
        uint256 threatScore,
        string actionTaken
    );

    // ─── Modifiers ──────────────────────────────────────────────────────────────
    modifier onlyAuthorizedGuardian() {
        require(
            registry.authorizedGuardians(msg.sender) || msg.sender == registry.owner(),
            "DefenseExecutor: Caller is not an authorized guardian"
        );
        _;
    }

    /// @dev Defense stops while the registry owner has paused the system.
    modifier whenRegistryNotPaused() {
        require(!registry.paused(), "DefenseExecutor: Registry is paused");
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────────────
    constructor(address _registryAddress) {
        require(_registryAddress != address(0), "DefenseExecutor: Invalid registry address");
        registry = SentinelRegistry(_registryAddress);
    }

    // ─── Defense Core Functions ─────────────────────────────────────────────────

    /**
     * @notice Atomically zero out approvals across multiple tokens and spenders for a protected user.
     * @dev A revocation is only reported as executed after the allowance is verified to be zero.
     *      Tokens that do not implement the guardian hook are reported as failures, not successes.
     * @param user Protected user address.
     * @param tokens List of token contracts.
     * @param spenders List of compromised spenders (parallel array).
     * @param threatScore Score that triggered this defense, for the on-chain audit trail.
     */
    function executeEmergencyBatchRevoke(
        address user,
        address[] calldata tokens,
        address[] calldata spenders,
        uint256 threatScore
    ) external nonReentrant onlyAuthorizedGuardian whenRegistryNotPaused {
        require(registry.isProtected(user), "DefenseExecutor: Target user has not activated shield");
        require(tokens.length == spenders.length, "DefenseExecutor: Mismatched array lengths");
        require(tokens.length > 0, "DefenseExecutor: Empty batch");

        uint256 revokedCount = 0;

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            address spender = spenders[i];

            if (token.code.length == 0) {
                emit EmergencyRevokeFailed(user, token, spender, "not a contract");
                continue;
            }

            // Attempt guardian-aware revocation if supported by the token.
            try IGuardianRevocable(token).guardianRevokeApproval(user, spender) {
                // Never trust the call: verify the allowance actually reached zero.
                if (IERC20(token).allowance(user, spender) == 0) {
                    revokedCount++;
                    emit EmergencyRevokeExecuted(user, token, spender, msg.sender, block.timestamp);
                } else {
                    emit EmergencyRevokeFailed(user, token, spender, "allowance not zeroed");
                }
            } catch {
                emit EmergencyRevokeFailed(user, token, spender, "revocation unsupported");
            }
        }

        // If no allowance was actually revoked, revert so the caller can try a sweep instead.
        require(revokedCount > 0, "DefenseExecutor: No allowances revoked");

        registry.recordDefenseAction(user, "BATCH_REVOKE");
        emit ThreatNeutralized(user, spenders[0], threatScore, "BATCH_REVOKE_COMPLETED");
    }

    /**
     * @notice Emergency sweep: Transfers vulnerable tokens directly to the user's pre-registered safe.
     * @dev Zero-Custody Invariant: Funds CANNOT be directed to msg.sender or the executor.
     *      They MUST go strictly to `emergencySafe` configured in SentinelRegistry.
     * @param user Protected user address.
     * @param tokens Array of ERC-20 tokens to sweep to safety.
     * @param threatScore Score that triggered this defense, for the on-chain audit trail.
     */
    function executeEmergencySweep(
        address user,
        address[] calldata tokens,
        uint256 threatScore
    ) external nonReentrant onlyAuthorizedGuardian whenRegistryNotPaused {
        SentinelRegistry.UserPolicy memory policy = registry.getUserPolicy(user);
        require(policy.isActive, "DefenseExecutor: Shield not active for user");
        address coldSafe = policy.emergencySafe;
        require(coldSafe != address(0), "DefenseExecutor: Invalid destination safe");
        require(coldSafe != msg.sender, "DefenseExecutor: Zero-custody invariant violated");
        require(coldSafe != address(this), "DefenseExecutor: Cannot sweep to executor");
        require(tokens.length > 0, "DefenseExecutor: Empty token list");

        uint256 rescuedTotal = 0;
        uint256 sweepCount = 0;

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i].code.length == 0) {
                continue;
            }

            IERC20 token = IERC20(tokens[i]);
            uint256 allowance = token.allowance(user, address(this));
            uint256 userBalance = token.balanceOf(user);
            uint256 amountToRescue = allowance < userBalance ? allowance : userBalance;

            if (amountToRescue > 0) {
                token.safeTransferFrom(user, coldSafe, amountToRescue);
                rescuedTotal += amountToRescue;
                sweepCount++;
                emit EmergencySweepExecuted(user, tokens[i], coldSafe, amountToRescue, block.timestamp);
            }
        }

        // A sweep that moved nothing must not be reported as a successful rescue.
        require(sweepCount > 0, "DefenseExecutor: No tokens rescued");

        totalAmountRescued += rescuedTotal;
        totalSweepsExecuted += sweepCount;
        registry.recordDefenseAction(user, "EMERGENCY_SWEEP");
        emit ThreatNeutralized(user, address(0), threatScore, "EMERGENCY_SWEEP_TO_COLD_SAFE");
    }
}
