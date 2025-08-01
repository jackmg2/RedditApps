import { Devvit } from '@devvit/public-api';
import { LinkerBoard } from './components/LinkerBoard.js';
import { useEditCellForm } from './forms/EditCellForm.js'; // Changed from useEditLinkForm
import { useEditPageForm } from './forms/EditPageForm.js';
import { useBackgroundImageForm } from './forms/BackgroundImageForm.js';
import { useLinkerData } from './hooks/useLinkerData.js';
import { useLinkerActions } from './hooks/useLinkerActions.js';
import './createPost.js';

Devvit.addCustomPostType({
  name: 'Community Links',
  height: 'tall',
  render: (context) => {
    // Data and actions - SINGLE SOURCE OF TRUTH
    const linkerDataHook = useLinkerData(context);
    const { linker, saveLinker, updateLinkerOptimistically } = linkerDataHook;
    const linkerActions = useLinkerActions({ 
      linker, 
      saveLinker, 
      updateLinkerOptimistically,
      context 
    });

    // Forms - Updated for cell management
    const editCellForm = useEditCellForm({ 
      onUpdateCell: linkerActions.updateCell // Changed from onUpdateLink
    });

    const editPageForm = useEditPageForm({ 
      onUpdatePage: linkerActions.updatePage 
    });

    const backgroundImageForm = useBackgroundImageForm({
      currentBackgroundImage: linker?.pages[0]?.backgroundImage || '',
      onUpdateBackgroundImage: linkerActions.updateBackgroundImage
    });

    // Form handlers - Updated for cell management
    const handleShowEditCellForm = (cell: any) => { // Changed from handleShowEditLinkForm
      // Ensure we have complete cell data for the form
      const cellWithDefaults = {
        id: cell.id,
        links: cell.links || [],
        weights: cell.weights || [],
        displayName: cell.displayName || '',
        rotationEnabled: cell.rotationEnabled || false,
        impressionCount: cell.impressionCount || 0,
        variantImpressions: cell.variantImpressions || {}
      };
      
      context.ui.showForm(editCellForm, { 
        e: JSON.stringify({
          ...cellWithDefaults,
          originalCell: cell // Pass original for preserving data
        })
      });
    };

    const handleShowEditPageForm = (pageData: any) => {
      context.ui.showForm(editPageForm, { e: JSON.stringify(pageData) });
    };

    const handleShowBackgroundImageForm = () => {
      context.ui.showForm(backgroundImageForm);
    };

    return (
      <LinkerBoard
        context={context}
        linkerDataHook={linkerDataHook}
        linkerActions={linkerActions}
        onShowEditCellForm={handleShowEditCellForm} // Changed from onShowEditLinkForm
        onShowEditPageForm={handleShowEditPageForm}
        onShowBackgroundImageForm={handleShowBackgroundImageForm}
      />
    );
  }
});

Devvit.configure({
  redditAPI: true,
  redis: true
});

export default Devvit;