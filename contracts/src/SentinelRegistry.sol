// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SentinelRegistry
 * @notice Central registry for PortalSentinel on Portaldot V3.
 *         Stores user protection preferences, emergency fallback safe addresses,
 *         and authorized Guardian automated agents.
 */
contract SentinelRegistry is Ownable, Pausable {

    // ─── Enums & Structs ────────────────────────────────────────────────────────
    enum DefenseMode {
        CONSERVATIVE, // Triggers only on critical severity threats (Score >= 80)
        BALANCED,     // Triggers on moderate-to-severe threats (Score >= 60)
        AGGRESSIVE    // Triggers on early abnormal anomalies (Score >= 40)
    }

    struct UserPolicy {
        bool isActive;
        DefenseMode mode;
        address emergencySafe;     // Cold destination where swept funds MUST land
        uint256 registeredTimestamp;
        uint256 lastDefenseActionTimestamp;
    }

    // ─── State ──────────────────────────────────────────────────────────────────
    /// user address => UserPolicy
    mapping(address => UserPolicy) public policies;

    /// Authorized Guardian operators who can trigger automated defense
    mapping(address => bool) public authorizedGuardians;

    /// Dedicated Defense Executor contract address
    address public defenseExecutor;

    /// Known threat contract addresses flagged by the sentinel network
    mapping(address => bool) public flaggedThreats;

    /// Total number of protected users
    uint256 public totalProtectedUsers;

    /// Total defense actions triggered
    uint256 public totalDefenseActions;

    // ─── Events ─────────────────────────────────────────────────────────────────
    event ShieldActivated(address indexed user, DefenseMode mode, address emergencySafe);
    event ShieldUpdated(address indexed user, DefenseMode mode, address emergencySafe);
    event ShieldDeactivated(address indexed user);
    event GuardianAuthorized(address indexed guardian, bool status);
    event DefenseExecutorSet(address indexed executor);
    event ThreatFlagged(address indexed threatAddress, uint256 threatScore, string reason);
    event DefenseRecordLogged(address indexed user, address indexed operator, string actionType);

    // ─── Modifiers ──────────────────────────────────────────────────────────────
    modifier onlyGuardianOrExecutor() {
        require(
            authorizedGuardians[msg.sender] || 
            msg.sender == owner() || 
            msg.sender == defenseExecutor,
            "SentinelRegistry: Caller not authorized guardian or executor"
        );
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────────────
    constructor(address _initialGuardian) Ownable(msg.sender) {
        if (_initialGuardian != address(0)) {
            authorizedGuardians[_initialGuardian] = true;
            emit GuardianAuthorized(_initialGuardian, true);
        }
    }

    // ─── User Functions ─────────────────────────────────────────────────────────

    /**
     * @notice Register a wallet for autonomous Sentinel protection.
     * @param _mode Sensitivity mode (0 = CONSERVATIVE, 1 = BALANCED, 2 = AGGRESSIVE).
     * @param _emergencySafe Cold wallet address (e.g. cold EVM or mapped Substrate account).
     */
    function registerShield(DefenseMode _mode, address _emergencySafe) external whenNotPaused {
        require(_emergencySafe != address(0), "SentinelRegistry: Invalid emergency safe address");
        require(_emergencySafe != msg.sender, "SentinelRegistry: Emergency safe should be distinct backup address");

        bool isNew = !policies[msg.sender].isActive;
        policies[msg.sender] = UserPolicy({
            isActive: true,
            mode: _mode,
            emergencySafe: _emergencySafe,
            registeredTimestamp: block.timestamp,
            lastDefenseActionTimestamp: 0
        });

        if (isNew) {
            totalProtectedUsers++;
            emit ShieldActivated(msg.sender, _mode, _emergencySafe);
        } else {
            emit ShieldUpdated(msg.sender, _mode, _emergencySafe);
        }
    }

    /**
     * @notice Update emergency fallback safe address.
     */
    function updateEmergencySafe(address _newSafe) external whenNotPaused {
        require(policies[msg.sender].isActive, "SentinelRegistry: Shield not active");
        require(_newSafe != address(0), "SentinelRegistry: Invalid emergency safe address");
        policies[msg.sender].emergencySafe = _newSafe;
        emit ShieldUpdated(msg.sender, policies[msg.sender].mode, _newSafe);
    }

    /**
     * @notice Update sensitivity defense mode.
     */
    function updateDefenseMode(DefenseMode _newMode) external whenNotPaused {
        require(policies[msg.sender].isActive, "SentinelRegistry: Shield not active");
        policies[msg.sender].mode = _newMode;
        emit ShieldUpdated(msg.sender, _newMode, policies[msg.sender].emergencySafe);
    }

    /**
     * @notice Deactivate Sentinel Shield.
     */
    function deactivateShield() external whenNotPaused {
        require(policies[msg.sender].isActive, "SentinelRegistry: Shield not active");
        policies[msg.sender].isActive = false;
        totalProtectedUsers--;
        emit ShieldDeactivated(msg.sender);
    }

    // ─── Guardian & Management Functions ────────────────────────────────────────

    /**
     * @notice Set the authorized DefenseExecutor contract.
     */
    function setDefenseExecutor(address _executor) external onlyOwner {
        require(_executor != address(0), "SentinelRegistry: Invalid executor");
        defenseExecutor = _executor;
        emit DefenseExecutorSet(_executor);
    }

    /**
     * @notice Log a defense action timestamp for a protected user.
     */
    function recordDefenseAction(address _user, string calldata _actionType) external onlyGuardianOrExecutor whenNotPaused {
        require(policies[_user].isActive, "SentinelRegistry: User not protected");
        policies[_user].lastDefenseActionTimestamp = block.timestamp;
        totalDefenseActions++;
        emit DefenseRecordLogged(_user, msg.sender, _actionType);
    }

    /**
     * @notice Flag a compromised protocol contract as a global threat.
     */
    function flagThreat(address _threatAddress, uint256 _threatScore, string calldata _reason) external onlyGuardianOrExecutor {
        flaggedThreats[_threatAddress] = true;
        emit ThreatFlagged(_threatAddress, _threatScore, _reason);
    }

    /**
     * @notice Authorize or revoke a Sentinel Guardian automation agent key.
     */
    function setGuardianStatus(address _guardian, bool _status) external onlyOwner {
        require(_guardian != address(0), "SentinelRegistry: Invalid guardian address");
        authorizedGuardians[_guardian] = _status;
        emit GuardianAuthorized(_guardian, _status);
    }

    /**
     * @notice Stop all user enrollment changes and autonomous defense actions.
     * @dev Only the owner can pause. Threat flagging remains available during a pause.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume normal operation.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── View Helpers ───────────────────────────────────────────────────────────

    function isProtected(address _user) external view returns (bool) {
        return policies[_user].isActive;
    }

    function getUserPolicy(address _user) external view returns (UserPolicy memory) {
        return policies[_user];
    }

    function getEmergencySafe(address _user) external view returns (address) {
        return policies[_user].emergencySafe;
    }

    function isThreat(address _target) external view returns (bool) {
        return flaggedThreats[_target];
    }
}
