# FlairAndApprove - Essential Test Plan

## Overview
Tests the core functionality of the FlairAndApprove app which streamlines user verification, approval, flair assignment, and welcome messaging in one workflow.

## Test Setup
- Install in test subreddit
- Configure settings: 
  - Default comment: "Welcome to the community!"
  - Auto-approve user: true
  - Auto-approve post: true
  - Auto-approve comment: true
  - Auto-add mod note: true
- Create at least 2 flair templates in the subreddit

## Critical Test Cases

### 1. Post Approval Flow
| Test | Steps | Expected |
|------|-------|----------|
| 1.1 | Click "Approve & Flair: Verify and approve" on a post | Form opens with user info pre-filled |
| 1.2 | Select flair, keep approve checkboxes checked | User approved, flair applied, post approved |
| 1.3 | Verify welcome comment | Comment posted and distinguished |
| 1.4 | Check mod notes | Mod note added with approval details |

### 2. Comment Approval Flow
| Test | Steps | Expected |
|------|-------|----------|
| 2.1 | Click "Approve & Flair: Verify and approve" on a comment | Form opens with comment info |
| 2.2 | Uncheck "Approve comment", select flair | User approved with flair, comment NOT approved |
| 2.3 | Verify selective approval | Only checked items are approved |

### 3. Bulk Approval
| Test | Steps | Expected |
|------|-------|----------|
| 3.1 | Click "Bulk Approve & Flair Users" from subreddit menu | Bulk form opens |
| 3.2 | Enter "user1, user2, user3" and select flair | All users processed |
| 3.3 | Verify all users | Each user approved with same flair |
| 3.4 | Check mod notes | Bulk approval noted for each user |

### 4. Export Approved Users
| Test | Steps | Expected |
|------|-------|----------|
| 4.1 | Add 3+ approved users to subreddit | Users in approved list |
| 4.2 | Click "Export Approved Users" | Form shows semicolon-separated list |
| 4.3 | Copy exported list | Format: "user1;user2;user3" |
| 4.4 | Test import in another subreddit | List compatible with bulk import |

### 5. Settings Behavior
| Test | Steps | Expected |
|------|-------|----------|
| 5.1 | Set auto-approve user to false | Checkbox unchecked by default in forms |
| 5.2 | Change default comment | New comment appears in forms |
| 5.3 | Disable auto-add mod note | No mod notes created on approval |
| 5.4 | Test empty comment field | No comment posted when field is empty |

### 6. Edge Cases
| Test | Steps | Expected |
|------|-------|----------|
| 6.1 | Approve already approved user | Operation succeeds, flair updated |
| 6.2 | Bulk approve with invalid usernames | Valid users processed, errors for invalid |
| 6.3 | No flair templates in subreddit | Error message displayed |
| 6.4 | Approve deleted user's post | Graceful error handling |

## Success Criteria
- ✅ Single-click workflow completes all selected actions
- ✅ Bulk operations process multiple users efficiently  
- ✅ Settings correctly control default behaviors
- ✅ Mod notes track approval actions when enabled
- ✅ Export format works for re-import
- ✅ Form pre-fills with correct context data
- ✅ Selective approval (unchecking boxes) works properly

## Key Validation Points
1. **Mod note timestamps** - Verify correct date/time and moderator name
2. **Flair application** - Correct flair template applied to users
3. **Comment distinction** - Welcome comments are mod-distinguished
4. **Bulk error handling** - Partial success with clear error reporting
5. **Export format** - Semicolon separation for compatibility

## Notes
- Test with both post and comment contexts to ensure both menu items work
- Verify settings persistence across mod team members
- Check that welcome comments are only posted when comment field has content
- Ensure bulk approval respects the "Approve all users" checkbox