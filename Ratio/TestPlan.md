# Reddit Ratio Bot - Manual Test Plan

## Overview
This test plan outlines the steps to manually verify all functionality of the Reddit Ratio Bot. The bot manages user post ratios to encourage specific types of contributions through enforced ratios between regular and monitored (special flaired) posts. The bot now supports both normal and inverted ratio modes.

## Test Environment Setup
1. Install the app in a test subreddit
2. Configure the app settings:
   - Set ratio value to 2 (for testing purposes)
   - Set monitored flairs to "Documentation;Fix"
   - Add custom ratio violation comment
   - Add custom wrong flair comment
   - Test both with inverted ratio OFF and ON

## Test Cases

### 1. Initial Configuration and Settings
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 1.1 | Verify app settings are applied | App settings should reflect the configured values | |
| 1.2 | Check if flairs in settings match available subreddit flairs | "Documentation" and "Fix" flairs should be available | |
| 1.3 | Toggle inverted ratio mode | Setting should save and apply correctly | |

### 2. Normal Mode Testing (Inverted Ratio = OFF)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 2.1 | Submit a regular post with no monitored flair | Post accepted, ratio shows [1/0] | |
| 2.2 | Submit a second regular post with no flair | Post accepted, ratio shows [2/0] | |
| 2.3 | Submit a third regular post with no flair | Post removed for violation, ratio remains [2/0] | |
| 2.4 | Submit a post with "Documentation" flair | Post accepted, ratio shows [2/1] | |
| 2.5 | Submit two more regular posts | Posts accepted, ratio shows [4/1] | |
| 2.6 | Submit another regular post | Post removed for violation, ratio remains [4/1] | |

### 3. Inverted Mode Testing (Inverted Ratio = ON, Ratio = 3)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 3.1 | Reset user ratio to [0/0] | Ratio reset successfully | |
| 3.2 | Submit a post with "Documentation" flair | Post removed (need 3 regular posts first), ratio remains [0/0] | |
| 3.3 | Submit 3 regular posts | All accepted, ratio shows [3/0] | |
| 3.4 | Submit a post with "Documentation" flair | Post accepted, ratio shows [3/1] | |
| 3.5 | Submit another "Documentation" post | Post removed (need 6 regular for 2 monitored), ratio remains [3/1] | |
| 3.6 | Submit 3 more regular posts | All accepted, ratio shows [6/1] | |
| 3.7 | Submit a "Documentation" post | Post accepted, ratio shows [6/2] | |

### 4. Post Deletion Testing (Both Modes)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 4.1 | [Normal mode] Delete a regular post | User ratio decreases regular count | |
| 4.2 | [Normal mode] Delete a monitored flair post | User ratio decreases monitored count | |
| 4.3 | [Inverted mode] Delete a regular post | User ratio decreases regular count | |
| 4.4 | [Inverted mode] Delete a monitored post | User ratio decreases monitored count | |
| 4.5 | [Inverted mode] After deletion, verify ratio enforcement | Posts should follow new ratio limits | |

### 5. Moderator Actions Testing (Both Modes)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 5.1 | Manually set user ratio from post menu | Ratio updates correctly in both modes | |
| 5.2 | Change flair in normal mode | Ratio updates, format [regular/monitored] | |
| 5.3 | Change flair in inverted mode | Ratio updates, format [regular/monitored] | |
| 5.4 | Change flair causing violation (inverted) | Post removed if violates inverted ratio | |
| 5.5 | Remove flair from monitored post | Ratio updates correctly | |
| 5.6 | Set ratio by username | Works in both modes | |

### 6. Wiki Page Testing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 6.1 | Check wiki in normal mode | Shows ratios as regular/monitored | |
| 6.2 | Check wiki in inverted mode | Shows ratios as regular/monitored | |
| 6.3 | Verify mode changes don't affect history | Previous records remain unchanged | |

### 7. Mode Switching Testing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 7.1 | Switch from normal to inverted with existing users | Existing ratios preserved, new rules apply | |
| 7.2 | Switch from inverted to normal | Existing ratios preserved, new rules apply | |
| 7.3 | Test ratio enforcement after mode switch | Correct mode rules are applied | |

### 8. Error Handling and Edge Cases

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 8.1 | Inverted mode with ratio=1 | 1:1 ratio enforced correctly | |
| 8.2 | Inverted mode with high ratio (e.g., 10) | Requires 10 regular posts per monitored | |
| 8.3 | Switch modes with posts in queue | Posts evaluated with current mode rules | |
| 8.4 | Zero regular posts in inverted mode | Cannot post with monitored flair | |

### 9. User Experience Testing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 9.1 | Check flair display format (normal) | Shows [regular/monitored] | |
| 9.2 | Check flair display format (inverted) | Shows [regular/monitored] | |
| 9.3 | Verify violation messages make sense | Messages clear for both modes | |

## Test Completion Checklist

- [ ] All test cases executed for normal mode
- [ ] All test cases executed for inverted mode
- [ ] Mode switching tested thoroughly
- [ ] All bugs and issues documented
- [ ] Regression testing completed for any fixed issues
- [ ] Performance testing completed in both modes
- [ ] Wiki functionality verified
- [ ] User notification functionality verified

## Notes
- Document any unexpected behavior
- Note any UI/UX improvements that could be made
- Record any error messages received during testing
- Pay special attention to ratio calculations in inverted mode