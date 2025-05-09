# Reddit Ratio Bot - Manual Test Plan

## Overview
This test plan outlines the steps to manually verify all functionality of the Reddit Ratio Bot. The bot manages user post ratios to encourage specific types of contributions through enforced ratios between regular and monitored (special flaired) posts.

## Test Environment Setup
1. Install the app in a test subreddit
2. Configure the app settings:
   - Set ratio value to 2 (for testing purposes)
   - Set monitored flairs to "Documentation;Fix"
   - Add custom ratio violation comment
   - Add custom wrong flair comment

## Test Cases

### 1. Initial Configuration and Settings
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 1.1 | Verify app settings are applied | App settings should reflect the configured values | |
| 1.2 | Check if flairs in settings match available subreddit flairs | "Documentation" and "Fix" flairs should be available | |

### 2. Post Submission Testing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 2.1 | Submit a regular post with no monitored flair | Post should be accepted, user ratio updated to 1/0 | |
| 2.2 | Submit a second regular post with no flair | Post should be accepted, user ratio updated to 2/0 | |
| 2.3 | Submit a third regular post with no flair | Post should be removed due to ratio violation (2/0 exceeds the allowed 2:1 ratio), ratio should remain 2/0 | |
| 2.4 | Submit a post with "Documentation" flair | Post should be accepted, user ratio updated to 2/1 | |
| 2.5 | Submit two more regular posts | Posts should be accepted, user ratio updated to 4/1 | |
| 2.6 | Submit another regular post | Post should be removed due to ratio violation (4/1 exceeds the allowed 2:1 ratio), ratio should remain 4/1 | |

### 3. Post Deletion Testing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 3.1 | Delete a regular post | User ratio should decrease to 3/1 | |
| 3.2 | Delete a post with "Documentation" flair | User ratio should decrease to 3/0 | |
| 3.3 | Submit a regular post after deletions | Post should be removed due to ratio violation (3/0 exceeds the allowed ratio), ratio remains 3/0 | |

### 4. Moderator Actions Testing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 4.1 | Manually set user ratio from post menu | User ratio should update to specified values in Redis and user flair | |
| 4.2 | Change post flair from regular to "Documentation" | User ratio should update (regular -1, monitored +1) | |
| 4.3 | Change post flair from "Documentation" to regular | User ratio should update (regular +1, monitored -1), check if wrong flair comment is posted | |
| 4.4 | Change post flair resulting in ratio violation | Post should be removed and user ratio should not update | |
| 4.5 | Remove flair from post with "Documentation" | Flair should be removed, user ratio should update (regular +1, monitored -1) | |
| 4.6 | Set user ratio by username from subreddit menu | User ratio should update to specified values | |
| 4.7 | Refresh wiki from subreddit menu | Wiki page should update with all ratio changes | |

### 5. Wiki Page Testing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 5.1 | Check wiki page creation | "redditratio" wiki page should be created | |
| 5.2 | Verify post history recording | All posts should be listed under user sections with dates and ratios | |
| 5.3 | Verify deleted post recording | Deleted posts should be marked with "[DELETED]" prefix | |
| 5.4 | Verify manual adjustment recording | Manual adjustments should be marked with "[MANUAL ADJUSTMENT]" | |

### 6. Error Handling and Edge Cases

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 6.1 | Attempt to remove flair from post with no flair | Should show error toast "This post does not have a flair to remove" | |
| 6.2 | Set user ratio with invalid username | Should show error toast that user was not found | |
| 6.3 | Set negative values for user ratio | Prevent negative values or handle them appropriately | |
| 6.4 | Check behavior when Redis is empty | Should initialize with default values (0/1) | |
| 6.5 | Test with multiple users | Each user should have their own independent ratio tracking | |

### 7. Performance Testing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 7.1 | Test with high volume of posts | App should handle large number of posts without significant delays | |
| 7.2 | Test with multiple simultaneous users | App should accurately track ratios for all users | |

## Test Completion Checklist

- [ ] All test cases executed
- [ ] All bugs and issues documented
- [ ] Regression testing completed for any fixed issues
- [ ] Performance testing completed
- [ ] Wiki functionality verified
- [ ] User notification functionality verified

## Notes
- Document any unexpected behavior
- Note any UI/UX improvements that could be made
- Record any error messages received during testing