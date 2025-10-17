import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:google_fonts/google_fonts.dart';

void main() {
  runApp(const WeatherApp());
}

class WeatherApp extends StatelessWidget {
  const WeatherApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Live Weather App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        textTheme: GoogleFonts.poppinsTextTheme(),
      ),
      home: const WeatherHomePage(),
    );
  }
}

class WeatherHomePage extends StatefulWidget {
  const WeatherHomePage({super.key});

  @override
  State<WeatherHomePage> createState() => _WeatherHomePageState();
}

class _WeatherHomePageState extends State<WeatherHomePage> {
  late Future<Map<String, dynamic>> _weatherFuture;
  final TextEditingController _cityController =
      TextEditingController(text: "London");

  @override
  void initState() {
    super.initState();
    _weatherFuture = fetchWeather(_cityController.text);
  }

  Future<Map<String, dynamic>> fetchWeather(String city) async {
    const apiKey = "5f76111111688d3a16696d294a7a9a10"; // 🔑 your API key
    final url = Uri.parse(
        "https://api.openweathermap.org/data/2.5/weather?q=$city&appid=$apiKey&units=metric");

    try {
      final response = await http.get(url);
      debugPrint("Response Code: ${response.statusCode}");
      debugPrint("Response Body: ${response.body}");

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        final error = jsonDecode(response.body);
        throw Exception(
            "Error ${response.statusCode}: ${error['message'] ?? 'Unknown error'}");
      }
    } catch (e) {
      throw Exception("Network or API error: $e");
    }
  }

  void _searchCity() {
    setState(() {
      _weatherFuture = fetchWeather(_cityController.text);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF4CA1AF), Color(0xFFC4E0E5)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              const SizedBox(height: 30),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _cityController,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          hintText: "Enter city name",
                          hintStyle:
                              const TextStyle(color: Colors.white70),
                          filled: true,
                          fillColor: Colors.white.withOpacity(0.2),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 15, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(20),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    ElevatedButton(
                      onPressed: _searchCity,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Colors.black87,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                      child: const Icon(Icons.search),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 30),
              Expanded(
                child: Center(
                  child: FutureBuilder<Map<String, dynamic>>(
                    future: _weatherFuture,
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            CircularProgressIndicator(color: Colors.white),
                            SizedBox(height: 20),
                            Text("Fetching weather data...",
                                style: TextStyle(color: Colors.white70)),
                          ],
                        );
                      } else if (snapshot.hasError) {
                        return Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.error_outline,
                                color: Colors.redAccent, size: 50),
                            const SizedBox(height: 10),
                            const Text('Something went wrong!',
                                style: TextStyle(
                                    color: Colors.white, fontSize: 20)),
                            const SizedBox(height: 10),
                            Text('${snapshot.error}',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                    color: Colors.white70, fontSize: 14)),
                            const SizedBox(height: 20),
                            ElevatedButton(
                              onPressed: _searchCity,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: Colors.black,
                              ),
                              child: const Text("Retry"),
                            ),
                          ],
                        );
                      } else if (snapshot.hasData) {
                        final data = snapshot.data!;
                        final cityName = data['name'];
                        final temp = data['main']['temp'].toStringAsFixed(1);
                        final description = data['weather'][0]['description'];
                        final iconCode = data['weather'][0]['icon'];

                        return GlassCard(
                          city: cityName,
                          temp: temp,
                          description: description,
                          iconCode: iconCode,
                        );
                      } else {
                        return const Text('No data available',
                            style: TextStyle(color: Colors.white));
                      }
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class GlassCard extends StatelessWidget {
  final String city;
  final String temp;
  final String description;
  final String iconCode;

  const GlassCard({
    super.key,
    required this.city,
    required this.temp,
    required this.description,
    required this.iconCode,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      margin: const EdgeInsets.symmetric(horizontal: 25),
      padding: const EdgeInsets.all(25),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.25),
        borderRadius: BorderRadius.circular(25),
        border: Border.all(color: Colors.white.withOpacity(0.4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black26,
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(city,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 30,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Image.network(
            'https://openweathermap.org/img/wn/$iconCode@2x.png',
            scale: 0.9,
          ),
          Text(
            "$temp°C",
            style: const TextStyle(
              color: Colors.white,
              fontSize: 46,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            description.toUpperCase(),
            style: const TextStyle(
                color: Colors.white70,
                fontSize: 18,
                letterSpacing: 1.2,
                fontWeight: FontWeight.w400),
          ),
        ],
      ),
    );
  }
}
