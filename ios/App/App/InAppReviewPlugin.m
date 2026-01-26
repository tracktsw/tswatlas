#import <Capacitor/Capacitor.h>

CAP_PLUGIN(InAppReviewPlugin, "InAppReview",
    CAP_PLUGIN_METHOD(requestReview, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(hasAlreadyRequested, CAPPluginReturnPromise);
)
