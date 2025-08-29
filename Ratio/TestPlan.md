# Reddit Ratio Bot - Essential Test Plan

## Overview
Tests the core functionality of the Reddit Ratio Bot which manages user post ratios to encourage specific contributions through two enforcement modes.

## Test Setup
- Install in test subreddit
- Configure: Ratio=3, Monitored Flairs="Documentation;Question", both "Decrease on removal" at true
- First test with normal mode then Inverted ratio
- Set your test user at 0/1 ratio.

## Critical Test Cases

### 1. Normal Mode Core Flow
| Test | Steps | Expected |
|------|-------|----------|
| 1.1 | Submit 3 regular posts (no flair) | All accepted, ratio shows [3/1] |
| 1.2 | Submit 4th regular post | **Post removed** (violates 3:1 ratio), ratio stays [3/1] |
| 1.3 | Submit post with "Documentation" flair | Accepted, ratio shows [3/2] |
| 1.4 | Submit 1 more regular posts | All accepted, ratio shows [4/2] |

### 2. Inverted Mode Core Flow  
| Test | Steps | Expected |
|------|-------|----------|
| 2.1 | Reset user to [0/0], enable inverted mode | Settings applied |
| 2.2 | Submit post with "Documentation" flair | **Post removed** (need 3 regular first), ratio stays [0/0] |
| 2.3 | Submit 3 regular posts | All accepted, ratio shows [3/0] |
| 2.4 | Submit "Documentation" post | Accepted, ratio shows [3/1] |
| 2.5 | Submit another "Documentation" post | **Post removed** (need 6 regular for 2 monitored), ratio stays [3/1] |

### 3. Post Deletion Behavior
| Test | Steps | Expected |
|------|-------|----------|
| 3.1 | User deletes regular post | Regular count decreases (if setting enabled) |
| 3.2 | User deletes monitored post | Monitored count decreases (if setting enabled) |
| 3.3 | Verify ratio enforcement after deletion | New limits apply correctly |

### 4. Moderator Tools
| Test | Steps | Expected |
|------|-------|----------|
| 4.1 | Use "Change flair and update ratio" | Flair changes, ratio updates, post removed if violates |
| 4.2 | Use "Remove flair" | Flair removed, ratio adjusted |
| 4.3 | Use "Manually set user ratio" | Ratio updated directly |
| 4.4 | Use "Set ratio by username" | Works for any user |

### 5. Exempt Users
| Test | Steps | Expected |
|------|-------|----------|
| 5.1 | Add user to exemptUsers setting | User bypasses all ratio rules |
| 5.2 | Exempt user posts with any flair | All posts accepted, no ratio in flair |
| 5.3 | Check wiki for exempt user | Shows "EXEMPT" instead of ratio |

### 6. Edge Cases
| Test | Steps | Expected |
|------|-------|----------|
| 6.1 | Mode switching with existing users | Existing ratios preserved, new rules apply |
| 6.2 | Posts removed for violations | User ratio unchanged |
| 6.3 | Wiki page generation | All actions tracked correctly |
| 6.4 | Invalid flair changes | Proper error handling |

## Success Criteria
- ✅ Ratio enforcement works correctly in both modes
- ✅ Posts violating ratios are removed WITHOUT affecting user ratios
- ✅ Post deletions adjust ratios according to settings
- ✅ Moderator tools function properly
- ✅ Exempt users bypass all restrictions
- ✅ Wiki tracking works for all actions
- ✅ Mode switching preserves existing data

## Key Validation Points
1. **Violation posts don't affect ratios** - This is critical behavior
2. **Ratio display format** - Always [regular/monitored] regardless of mode  
3. **Exempt user complete bypass** - No restrictions, no ratio display
4. **Wiki tracking** - All actions including deletions and manual changes

## Notes
- Focus testing on the violation removal behavior (posts removed don't count)
- Verify deletion settings work correctly (`decreaseMonitoredOnRemoval`, `decreaseRegularOnRemoval`)
- Test mode switching doesn't break existing user data
- Ensure exempt users are completely bypassed from all ratio logic