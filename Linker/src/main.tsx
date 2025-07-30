import { Devvit } from '@devvit/public-api';
import { LinkerBoard } from './components/LinkerBoard.js';
import { useEditLinkForm } from './forms/EditLinkForm.js';
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

    // Forms
    const editLinkForm = useEditLinkForm({ 
      onUpdateLink: linkerActions.updateLink 
    });

    const editPageForm = useEditPageForm({ 
      onUpdatePage: linkerActions.updatePage 
    });

    const backgroundImageForm = useBackgroundImageForm({
      currentBackgroundImage: linker?.pages[0]?.backgroundImage || '',
      onUpdateBackgroundImage: linkerActions.updateBackgroundImage
    });

    // Form handlers
    const handleShowEditLinkForm = (link: any) => {
      context.ui.showForm(editLinkForm, { e: JSON.stringify(link) });
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
        onShowEditLinkForm={handleShowEditLinkForm}
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