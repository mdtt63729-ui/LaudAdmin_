package com.laudadmin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Redo
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            LaudaAdminApp()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun LaudaAdminApp() {
    var selectedTab by remember { mutableIntStateOf(0) }
    var isOpeningFile by remember { mutableStateOf(false) }

    val expressiveSpring = spring<Float>(
        dampingRatio = Spring.DampingRatioMediumBouncy,
        stiffness = Spring.StiffnessMediumLow
    )

    MaterialTheme(colorScheme = darkColorScheme()) {
        Box(modifier = Modifier.fillMaxSize()) {
            Scaffold(
                modifier = Modifier.fillMaxSize(),
                topBar = {
                    TopAppBar(
                        title = { Text("LAUDA Admin") },
                        actions = {
                            IconButton(onClick = { /* Undo */ }) {
                                Icon(Icons.AutoMirrored.Filled.Undo, contentDescription = "Undo")
                            }
                            IconButton(onClick = { /* Redo */ }) {
                                Icon(Icons.AutoMirrored.Filled.Redo, contentDescription = "Redo")
                            }
                            IconButton(onClick = { /* Version History */ }) {
                                Icon(Icons.Filled.History, contentDescription = "Version History")
                            }
                        }
                    )
                }
            ) { innerPadding ->
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                        .padding(16.dp)
                ) {
                    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                        listOf("Dashboard", "Editor", "History").forEachIndexed { index, label ->
                            SegmentedButton(
                                selected = selectedTab == index,
                                onClick = { selectedTab = index },
                                shape = SegmentedButtonDefaults.itemShape(index = index, count = 3)
                            ) {
                                Text(label)
                            }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    AnimatedContent(
                        targetState = selectedTab,
                        transitionSpec = {
                            (fadeIn(expressiveSpring) + scaleIn(expressiveSpring, initialScale = 0.94f)) togetherWith
                                (fadeOut() + scaleOut(targetScale = 0.97f))
                        },
                        label = "screen_transition"
                    ) { tab ->
                        ElevatedCard(modifier = Modifier.fillMaxSize()) {
                            Column(
                                modifier = Modifier.padding(20.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = when (tab) {
                                        0 -> "Two-Column Configuration Dashboard"
                                        1 -> "Generic Visual Editor with Undo/Redo"
                                        else -> "GitHub File Commit History & Restore"
                                    },
                                    style = MaterialTheme.typography.titleMedium
                                )
                                FilledTonalButton(onClick = { isOpeningFile = !isOpeningFile }) {
                                    Text("Preview Contained Loading")
                                }
                            }
                        }
                    }
                }
            }

            // Smooth Enter & Exit Overlay with Material 3 ContainedLoadingIndicator
            AnimatedVisibility(
                visible = isOpeningFile,
                enter = fadeIn(expressiveSpring) + scaleIn(expressiveSpring, initialScale = 0.84f),
                exit = fadeOut() + scaleOut(targetScale = 0.88f)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.35f)),
                    contentAlignment = Alignment.Center
                ) {
                    Surface(
                        shape = RoundedCornerShape(24.dp),
                        tonalElevation = 6.dp
                    ) {
                        Column(
                            modifier = Modifier.padding(horizontal = 28.dp, vertical = 24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            ContainedLoadingIndicator()
                            Text(
                                text = "Fetching latest snapshot...",
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }
            }
        }
    }
}
