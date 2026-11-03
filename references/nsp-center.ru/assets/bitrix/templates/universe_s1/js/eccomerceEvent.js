function runEccomerceEvent(eventName, additionalData) {

    let request = $.ajax({
        type: "POST",
        url: "/ajax/getDataForGoogleAnalitics.php",
        data: {
            eventName: eventName,
            additionalData: additionalData
        }
    });

    request.done(function (data) {
        let gtagArguments = JSON.parse(data);
        gtag("event", eventName, gtagArguments);
    });
}

